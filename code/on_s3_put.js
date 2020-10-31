'use strict'
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

const pug = require('pug');
const jsondiffpatch = require('jsondiffpatch');
const fetch = require('node-fetch');

const bucket = process.env.BUCKET_NAME
const region = process.env.REGION

exports.handler = function (event, context, callback) {
    // getVersionId from event
    // console.log('versionId ', event.Records[0].s3.object.versionId);

    // get previous VersionId from AWS SDK
    s3.listObjectVersions({
        Bucket: bucket, 
        Prefix: event.Records[0].s3.object.key,
        VersionIdMarker: event.Records[0].s3.object.versionId,
        MaxKeys: 1,
        KeyMarker: event.Records[0].s3.object.key
       }, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            // compare and generate HTML diff
            Promise.all([
                fetch(`https://${bucket}.s3.${region}.amazonaws.com/${event.Records[0].s3.object.key}?versionId=${data.Versions[0].VersionId}`),
                fetch(`https://${bucket}.s3.${region}.amazonaws.com/${event.Records[0].s3.object.key}?versionId=${data.VersionIdMarker}`)
            ]).then(function (responses) {
                // Get a JSON object from each of the responses
                return Promise.all(responses.map(function (response) {
                    return response.json();
                }));
            }).then(function (data) {
                var params = {
                    Body: pug.renderFile('diff.pug', {
                        delta: JSON.stringify(jsondiffpatch.diff(data[0], data[1]))
                    }), 
                    Bucket: bucket, 
                    Key: event.Records[0].s3.object.key + '.diff',
                    ACL: "public-read",
                    ContentType: 'text/html'
                };

                s3.putObject(params, function(err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else {
                        console.log(`http://${bucket}.s3.${region}.amazonaws.com/${event.Records[0].s3.object.key}.diff?versionId=${data.VersionId}`);
                        // push to Slack
                        // *merchant* just updated their menu *URL* (3 new items, 45 modifiers) ; see diff here xxxxxx
                    }
                    callback()
                });
            }).catch(function (error) {
                // if there's an error, log it
                console.log(error);
            });
        }
    });
}
