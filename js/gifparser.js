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
		frames = [];

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
		var lzwData = getSubBlocks();
		block.data = lzwData;
		//block.pixels = lzwDecode(block.lzwMinCodeSize, lzwData);

		if (block.interlaced) {
			//Pass in object so we don't copy pixel table and make GC work
			//deinterlace(block,block.width);
		}
	}

	function getColorTable(ent) {
		var ct = [];
	    for (var i = 0; i < ent; i++) {
	      ct.push(getBytes(3));
	    }
	    return ct;
	}
	function getSubBlocks() {
		var subBlockSize = 0, data = '';
		do {
			subBlockSize = jview.getUint8(jview.tell());
			data += jview.getString(subBlockSize, jview.tell());
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