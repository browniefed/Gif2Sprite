Gif2Sprite
-------------
2 for the price of one!
I set out to create one library and after the complexity of splitting gif frames and all that jazz I've turned it into 2.

1.  GifParser.js - Parses the actual gif using a jDataView object
2.  Gif2Sprite.js - Uses GifParser to do some canvas work and turn an animated gif into a sprite, or extract certain frames, etc
     

-- Synchronous and Asynchronous
Serious props to http://www.matthewflickinger.com/lab/whatsinagif/index.html , wikipedia on GIFs, and https://github.com/shachaf/jsgif

jsgif does the GifParsing(getting frames) and with the bookmarklet allowed you to control them but only in an asynchronous manner and hasn't been updated in 2 years, but was a great resource.

TODO
----------------

1. Fast LZW Gif Decompression
2. Create a class to read Bytes, too many getUint8/getUint16s scatted everywhere
3. Make some sub classes inside GifParser
4. Handle GIFs more properly
5. Make a sprite out of the shit... duh
6. Make asynchronous so execution does get stopped like it does now, TOO SLOW!