var Jimp = require("jimp");
var path = require('path'),
fs = require('fs');

module.exports = {
    resizeImage: function (imageURL, destPath, width, height) {
        //make sure folder exist
        var dirname = path.dirname(destPath);
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname);
        }

        Jimp.read(imageURL).then(function (lenna) {
            lenna.resize(parseInt(width), parseInt(height))          // resize 
                .quality(100)                                         // set JPEG quality 
                //.greyscale()                                         // set greyscale 
                .write(destPath);

            // save 
        }).catch(function (err) {
            console.error(err);
        });
    }
}