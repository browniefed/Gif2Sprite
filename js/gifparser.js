//Accepts a jDataView object
var GifParser = function(view) {
	var jview = view,
		info = {length:jview.buffer.length},
		img = {
			width: 0,
			height: 0,
			frames: 0,
			type: '',
			ver: ''
		}
	    header = {
		    	gctFlag: 0,
		    	colorRes: 0,
		    	sorted: 0,
		    	gctSize: 0,
		    	bcIndex: 0,
		    	pixelAspRatio: 0,
		    	gct: null
		},
		blocks = [],
		frames = [],
		canvas = document.createElement('canvas'),
		context = canvas.getContext('2d');

	function isGif() {
		return (img.type === 'GIF');
	}

	function getIntro() {
		//Just how GIFs are formatted
		img.type = jview.getString(3);
		img.ver = jview.getString(3);
		//little-endian
		img.width = jview.getUint16(jview.tell(),true);
		img.height = jview.getUint16(jview.tell(),true);
		//Must reset
		var reset = jview.tell();
		img.frames = frameCount();
		//Counting the frames in a loop will FUCK UP .tell(), so reset back to where it should be
		jview.seek(reset);
	}

	function getHeader() {
		
		//packed flag yo
		var bits = byteToBitArr(jview.getUint8(jview.tell()));
		header.gctFlag = bits.shift();
	    header.colorRes = bitsToNum(bits.splice(0, 3));
	    header.sorted = bits.shift();
	    header.gctSize = bitsToNum(bits.splice(0, 3));
	    header.bcIndex = jview.getUint8(jview.tell());
	    header.pixelAspRatio = jview.getUint8(jview.tell());

	    if (header.pixelAspRatio !== 0) {
			header.pixelAspRatio = ((header.pixelAspRatio + 15) / 64)
	    }
	    if (header.gctFlag) {
	    	//Pass in color amount, bit shift left to get full table, max 256
	    	//Formula 2 ^ (N+1) for colorTable size
	    	header.gct = getColorTable(1 << (header.gctSize + 1));
	    }
	}

	function getBlocks() {
		var block = {};
		//Start parsing out blocks;
		//Passing in object blocks by reference 
		block.sentinel = jview.getUint8(jview.tell());
		switch(String.fromCharCode(block.sentinel)) {
			case '!':
				block.type = 'gce';
				getBlock(block);
			break;

			case ',':
				block.type = 'img';
				getImage(block);
			break;

			case ';':
				block.type = 'eof';
			break;
			default:
				console.log(block.sentinel.toString(16));
				throw new Error('Did not expect 0x' . block.sentinel.toString(16));
		}

		if (block.type === 'img') {
			frames.push(block);
		} else {
			blocks.push(block)
		}
		//Loop through and grab all blocks
		if (block.type !== 'eof') {
			getBlocks();
		}
	}

	function getBlock(block) {

		function getAppBlock(block) {
			block.type = 'app';
			//Always 11
			block.size = jview.getUint8(jview.tell());
			block.identifier = jview.getString(8, jview.tell());
			block.authCode = jview.getString(3, jview.tell());

			if (block.identifier === 'NETSCAPE') {
				var sub = jview.getUint8(jview.tell());
				jview.seek(jview.tell() + parseInt(sub, 16) + 1);
			} else {
				var data = getSubBlocks();
				block.data = data;
			}
		}

		function getComBlock(block) {
			block.type = 'com';
		}

		function getGCEBlock(block) {
			block.type = 'gce';
			block.size = jview.getUint8(jview.tell());
			var bits = byteToBitArr(jview.getUint8(jview.tell()));
			block.reserved = bitsToNum(bits.splice(0,3));
			block.disposal = bitsToNum(bits.splice(0,3));
			block.userInput = bits.shift();
			block.transColor = bits.shift();
			block.delay = jview.getUint16(jview.tell(),true);
			block.transColorInd = jview.getUint8(jview.tell());
			//Ends in 00 Block term, should just seek over instead of get Uint8
			jview.seek(jview.tell() + 1);			
		}

		function getPTEBlock(block) {
			block.type = 'pte';
		}

		block.label = jview.getUint8(jview.tell());

		switch(block.label) {
			case 255:
				//App Extensions
				getAppBlock(block);
				break;
			case 254:
				//Comment Extension
				getComBlock(block);
				break;

			case 249:
				//GCE
				getGCEBlock(block);
				break;
			case 1:
				//Plain Text Extension
				getPTEBlock(block);
				break;
		}
	}

	function getImage(block) {

		block.left = jview.getUint16(jview.tell(), true);
		block.top = jview.getUint16(jview.tell(),true);
		block.width = jview.getUint16(jview.tell(),true);
		block.height = jview.getUint16(jview.tell(),true);
		var bits = byteToBitArr(jview.getUint8(jview.tell()));
		block.lctFlag = bits.shift();
		block.interlaced = bits.shift();
		block.sort = bits.shift();
		block.reserved = bits.splice(0,2);
		block.lctSize = bitsToNum(bits.splice(0,3));

		if (block.lctFlag) {
			block.lct = getColorTable(1 << (block.lctSize + 1));
		}

		block.lzwMinCodeSize = jview.getUint8(jview.tell());
		//Returns array of Integers
		var lzwData = getSubBlocks(true);
		//block.pixels = lzwData;
		block.pixels = lzwDecode(block.lzwMinCodeSize, lzwData);

		if (block.interlaced) {
			//Pass in object so we don't copy pixel table and make GC work
			//deinterlace(block,block.width);
		}
		block.imgData = pixelsToData(block);
	}

	function lzwDecode(minCodeSize, data) {
	  // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
	  var pos = 0; // Maybe this streaming thing should be merged with the Stream?

	  var readCode = function(size) {
	    var code = 0;
	    for (var i = 0; i < size; i++) {
	      if (data[pos >> 3] & (1 << (pos & 7))) {
	        code |= 1 << i;
	      }
	      pos++;
	    }
	    return code;
	  };

	  var output = [];

	  var clearCode = 1 << minCodeSize;
	  var eoiCode = clearCode + 1;

	  var codeSize = minCodeSize + 1;
	  var dict = [];

	  var clear = function() {
	    dict = [];
	    codeSize = minCodeSize + 1;
	    for (var i = 0; i < clearCode; i++) {
	      dict[i] = [i];
	    }
	    dict[clearCode] = [];
	    dict[eoiCode] = null;

	  };

	  var code;
	  var last;

	  while (true) {
	    last = code;
	    code = readCode(codeSize);

	    if (code === clearCode) {
	      clear();
	      continue;
	    }
	    if (code === eoiCode) break;

	    if (code < dict.length) {
	      if (last !== clearCode) {
	        dict.push(dict[last].concat(dict[code][0]));
	      }
	    } else {
	      if (code !== dict.length) throw new Error('Invalid LZW code.');
	      dict.push(dict[last].concat(dict[last][0]));
	    }
	    output.push.apply(output, dict[code]);

	    if (dict.length === (1 << codeSize) && codeSize < 12) {
	      // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
	      codeSize++;
	    }
	  }

	  // I don't know if this is technically an error, but some GIFs do it.
	  //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
	  return output;
	};
	function pixelsToData(img) {
		var imgData = context.getImageData(img.left, img.top, img.width, img.height);
		img.pixels.forEach(function(pixel, i) {
			imgData.data[i * 4 + 0] = header.gct[pixel][0];
			imgData.data[i * 4 + 1] = header.gct[pixel][1];
			imgData.data[i * 4 + 2] = header.gct[pixel][2];
			imgData.data[i * 4 + 3] = 255;
		});
		context.putImageData(imgData, img.left, img.top);
		return canvas.toDataURL();
	}

	function getColorTable(ent) {
		var ct = [];
	    for (var i = 0; i < ent; i++) {
	      ct.push(getBytes(3));
	    }
	    return ct;
	}
	function getSubBlocks(type) {
		var subBlockSize = 0, data = '';
		if (typeof type === 'undefined') {
			type = false
		} else {
			data = [];
		}
		do {
			subBlockSize = jview.getUint8(jview.tell());
			if (!type) {
				data += jview.getString(subBlockSize, jview.tell());
			} else {
				for (var i = 1; i <= subBlockSize; i++) {
					data.push(jview.getUint8(jview.tell()));
				}
			}
		} while (subBlockSize !== 0)
		return data;
	}

	function frameCount() {
		var count = 0;
		//This could be consolidated later
		//Get String, convert to HEX and compare to hex string, something other than a big if statement
		for (var i=0, len = info.length - 9; i < len; ++i) {
			if (jview.getUint8(i) === 0 && jview.getUint8(i+1) === 33 && jview.getUint8(i+2) === 249 && 
				jview.getUint8(i+3) === 4 && jview.getUint8(i + 8) === 0 && (jview.getUint8(i+9) === 44 || jview.getUint8(i+9) === 33)) {
				count+=1;
			}
		}
		return count;
	}

	function getBytes(n) {
		var bytes = [];
		for (var i = 0; i < n; i++) {
			bytes.push(jview.getUint8(jview.tell()));
		}
		return bytes;
	}

	function byteToBitArr(bite) {
	  var a = [];
	  for (var i = 7; i >= 0; i--) {
	    a.push(!!(bite & (1 << i)));
	  }
	  return a;
	}

	function bitsToNum(ba) {
		return ba.reduce(function(s, n) { return s * 2 + n; }, 0);
	};

	//Initiate grabbing all the data
	getIntro();
	getHeader();
	getBlocks();

	return {
		isGif: isGif,
		info: info,
		img: img,
		blocks: blocks,
		header: header,
		frames: frames
	}

}