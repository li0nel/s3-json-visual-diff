'use strict'
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

const pug = require('pug');
const jsondiffpatch = require('jsondiffpatch');
const fetch = require('node-fetch');

const bucket = process.env.BUCKET_NAME
const region = process.env.REGION

exports.handler = function (event, context, callback) {
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
            let menu_one = `https://${bucket}.s3.${region}.amazonaws.com/${event.Records[0].s3.object.key}?versionId=${data.Versions[0].VersionId}`
            let menu_two = `https://${bucket}.s3.${region}.amazonaws.com/${event.Records[0].s3.object.key}?versionId=${data.VersionIdMarker}`
            // compare and generate HTML diff
            Promise.all([
                fetch(menu_one),
                fetch(menu_two)
            ]).then(function (responses) {
                // Get a JSON object from each of the responses
                return Promise.all(responses.map(function (response) {
                    return response.json();
                }));
            }).then(function (data) {
                let delta = jsondiffpatch.diff(data[0], data[1])
                let nb_items = delta.items ? Object.keys(delta.items).length : 0
                let nb_menus = delta.menus ? Object.keys(delta.menus).length : 0
                let nb_modifiers = delta.modifiers ? Object.keys(delta.modifiers).length : 0

                if (nb_menus || nb_items || nb_modifiers) {
                    var params = {
                        Body: pug.renderFile('diff.pug', {
                            delta: JSON.stringify(delta)
                        }), 
                        Bucket: bucket, 
                        Key: event.Records[0].s3.object.key + '.diff',
                        ACL: "public-read",
                        ContentType: 'text/html'
                    };
    
                    s3.putObject(params, function(err, data) {
                        if (err) console.log(err, err.stack); // an error occurred
                        else if (process.env.SLACK_INCOMING_WEBHOOK != undefined) {
                            // Push to Slack
                            fetch(process.env.SLACK_INCOMING_WEBHOOK, {
                                method: 'post',
                                body: JSON.stringify({
                                    "text": `${nb_menus} menu(s), ${nb_items} item(s) and ${nb_modifiers} modifier(s) updated on \`${event.Records[0].s3.object.key.replace("api/menu/", "")}\` ; <${menu_one}|before> <${menu_two}|after> <http://${bucket}.s3.${region}.amazonaws.com/${event.Records[0].s3.object.key}.diff?versionId=${data.VersionId}|diff>`
                                }),
                                headers: {'Content-Type': 'application/json'}
                            }).then(res => callback());
                        }
                        
                    });
                } else {
                    console.log('no menu update')
                    callback()
                }
            }).catch(function (error) {
                // if there's an error, log it
                console.log(error);
            });
        }
    });
}
