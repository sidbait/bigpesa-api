const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

aws.config.update({
    // Your SECRET ACCESS KEY from AWS should go here,
    // Never share it!
    // Setup Env Variable, e.g: process.env.SECRET_ACCESS_KEY
    secretAccessKey: "kSoGtJvARexB8are0jnaeezfYGXsUNwKfvqMll1/",
    // Not working key, Your ACCESS KEY ID from AWS should go here,
    // Never share it!
    // Setup Env Variable, e.g: process.env.ACCESS_KEY_ID
    accessKeyId: "AKIAIR5WFEWX433MIGCA",
    region: 'ap-south-1' // region of your bucket
});


const s3 = new aws.S3();
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'static.bigpesa.in',
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            let dt = new Date();
            cb(null, 'player/' + dt.getFullYear() + '/' + (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + Date.now().toString() + '-' + file.originalname)
        }
    })
})
singleUpload = upload.single('image')


async function  uploadImage (req, res)  {

    singleUpload(req, res, function (err, some) {

        try {

            var response = {};

            if (err) {
                response.success = false;
                response.message = 'Error - ' + err.message.toString();
                response.data = null;
                return res.json(response);
            }

            response.success = true;
            response.message = 'Image Uploaded';
            response.data = { 'imageUrl': req.file.location }
            return res.json(response);

        } catch (error) {

            let err_res = {};
            err_res.success = false;
            err_res.message = 'Error - ' + error.toString();
            err_res.data = null;
            return res.json(err_res);
        }

    });

}

module.exports = {upload :uploadImage };