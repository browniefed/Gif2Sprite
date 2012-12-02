/*
  lzwjs.js - Javascript implementation of LZW compress and decompress algorithm
  Copyright (C) 2009 Mark Lomas

  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License
  as published by the Free Software Foundation; either version 2
  of the License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

// Used to write values represented by a user specified number of bits into 
// a 'bytestream' array.
function OutStream()
{
    this.bytestream = new Array();
    this.offset = 0;

    this.WriteBit = function(val)
    {
       	this.bytestream[this.offset>>>3] |= val << (this.offset & 7);
        this.offset++;
    }

    this.Write = function(val, numBits)
    {
        // Write LSB -> MSB
        for(var i = 0; i < numBits; ++i)
            this.WriteBit((val >>> i) & 1);
    }
}

// Used to read values represented by a user specified number of bits from 
// a 'bytestream' array.
function InStream(bytestream, bitcount)
{
	this.bytestream = bytestream;
	this.bitcount = bitcount;
	this.offset = 0;

	this.ReadBit = function()
	{
	    var tmp = this.bytestream[this.offset>>>3] >> (this.offset & 7);
	    this.offset++;
	    return tmp&1;
	}

	this.Read = function(numBits)
	{
	    if((this.offset + numBits) > this.bitcount)
	        return null;

	    // Read LSB -> MSB
	    var val = 0;
	    for(var i = 0; i < numBits; ++i)
	        val |= this.ReadBit() << i;

	    return val;
	}
}


function LZWCompressor(outstream)
{
        this.output = outstream;

	// Hashtable dictionary used by compressor
	this.CompressDictionary = function() 
	{
	    this.hashtable = new Object();
	    this.nextcode = 0;

	    // Populate table with all possible character codes.
	    for(var i = 0; i < 256; ++i)
	    {
	        var str = String.fromCharCode(i);
	        this.hashtable[str] = this.nextcode++;
	    }    


	    this.Exists = function(str)
	    {
	        return (this.hashtable.hasOwnProperty(str));
	    }

	    this.Insert = function(str)
	    {
	        var numBits = this.ValSizeInBits();
	        this.hashtable[str] = this.nextcode++;
	        return numBits;
	    }

	    this.Lookup = function(str)
	    {
	        return (this.hashtable[str]);
	    }

	    this.ValSizeInBits = function()
	    {
	        // How many bits are we currently using to represent values?
	        var log2 = Math.log(this.nextcode + 1)/Math.LN2;
	        return Math.ceil(log2);
	    }
	};


	// LZW compression algorithm. See http://en.wikipedia.org/wiki/LZW
	this.compress = function(str)
	{
	   var length = str.length;
	   if(length == 0)
	       return output.bytestream;

	   var dict = new this.CompressDictionary();
	   var numBits = dict.ValSizeInBits();
	   var w = "";
	   for(var i = 0; i < length; ++i)
	   {
	       var c = str.charAt(i);
	       if(dict.Exists(w + c))
	       {
	           w = w + c;
	       }
	       else
	       {
	           numBits = dict.Insert(w + c);
	           this.output.Write(dict.Lookup(w), numBits); // Looks-up null on first interation.
	           w = c;
	       }
	   }
	   this.output.Write(dict.Lookup(w), numBits);
	};

} // end of LZWCompressor

function LZWDecompressor(instream)
{
	this.input = instream;

	this.DecompressDictionary = function()
	{
	    this.revhashtable = new Array();
	    this.nextcode = 0;

	    // Populate table with all possible character codes.
	    for(var i = 0; i < 256; ++i)
	    {
	        this.revhashtable[this.nextcode++] = String.fromCharCode(i);
  	    }

	    this.numBits = 9;

	    this.Size = function()
	    {
	        return (this.nextcode);
	    }

	    this.Insert = function(str)
	    {
	        this.revhashtable[this.nextcode++] = str;

	        // How many bits are we currently using to represent values?
		// Look ahead one value because the decompressor lags one iteration
		// behind the compressor.
	        var log2 = Math.log(this.nextcode + 2)/Math.LN2;
	        this.numBits = Math.ceil(log2);
	        return this.numBits;
	    }

	    this.LookupIndex = function(idx)
	    {
		return this.revhashtable[idx];
	    }

	    this.ValSizeInBits = function()
	    {
	        return this.numBits;
	    }
	}

	// LZW decompression algorithm. See http://en.wikipedia.org/wiki/LZW
	// Correctly handles the 'anomolous' case of 
	// character/string/character/string/character (with the same character 
	// for each character and string for each string).
	this.decompress = function(data, bitcount)
	{
	   if(bitcount == 0)
	       return "";

	   var dict = new this.DecompressDictionary();
	   var numBits = dict.ValSizeInBits();

	   var k = this.input.Read(numBits);
	   var output = String.fromCharCode(k);
	   var w = output;
	   var entry = "";

	   while ((k = this.input.Read(numBits)) != null)
	   {
	      if (k < dict.Size()) // is it in the dictionary?
	          entry = dict.LookupIndex(k); // Get corresponding string.
	      else 
	          entry = w + w.charAt(0);
	
	      output += entry;
	      numBits = dict.Insert(w + entry.charAt(0));
	      w = entry;
	   }
	
	   return output;
	};

} // end of LZWDecompressor





