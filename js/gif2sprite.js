var Gif2Sprite = Gif2Sprite || {};

(function(window, document, undefined) {

	Gif2Sprite = function(input) {
		var img = input,
		    canvas = document.createElement('canvas'),
		    context = canvas.getContext('2d');
		    

		function toSprite(combine) {
			var combine = combine || true;
			try {
				file = getFile();
				var parser = new GifParser(new jDataView(file));
				console.log(parser);
				
			} catch (err) {
				//Handle the error
				console.log(err)
			}
		}

		function getFile(bufarray) {
			var xhr = new XMLHttpRequest;
			xhr.open("GET", img, false);
            xhr.overrideMimeType("text/plain; charset=x-user-defined");

            xhr.send()
            if (xhr.status != 200) {
            	throw new Error('Failed to download file');
            }
			//Can't use responseType bufferarray for synchronous requests, STUPID!!!
			return xhr.responseText; 
		}
		
		return {
			toSprite: toSprite
		}

	}


}(window, document));
