<!DOCTYPE html>
<html>
	<head>
		<title>Gif 2 Sprite Lib</title>
		<meta charset="UTF-8">
		<link href="css/reset.css" type="text/css" rel="stylesheet">
		<link href="css/style.css" type="text/css" rel="stylesheet">
	</head>
	<body>

	
	<img src="img/swansondance.gif">
	<img src="img/rotatingearth.gif">
	<img src="img/sample.gif">
	<img src="img/dancing.gif">
	<div id="fillme">
	
	</div>
	
	<script src="//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
	<script src="js/jdataview.js"></script>
	<script src="js/gifparser.js"></script>
	<script src="js/gif2sprite.js"></script>
	<script type="text/javascript">
	//bookmarklet();
	var ronswan = Gif2Sprite('img/dancing.gif');
	var parser = ronswan.toSprite(true);

	$.each(parser.frames, function(i, val) {
		console.log(val);
		var img = $('<img />', {
			src: val.imgData
		});
		$('#fillme').append(img);
	});
	console.log(parser);
	</script>
	</body>
</html>
