'use strict'
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

const pug = require('pug');
const jsondiffpatch = require('jsondiffpatch').create({
    objectHash: function(obj) {
        return obj.id;
    },
    arrays: {
        detectMove: false
    }
});

const fetch = require('node-fetch');

const bucket = process.env.BUCKET_NAME
const region = process.env.REGION

var sort_by_id = function(a, b){
    if(a.id < b.id) return -1
    else if(a.id > b.id) return 1
    else return 0
}

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
        else if (data.Versions.length) {
            let menu_one = `https://s3.${region}.amazonaws.com/${bucket}/${event.Records[0].s3.object.key}?versionId=${data.Versions[0].VersionId}`
            let menu_two = `https://s3.${region}.amazonaws.com/${bucket}/${event.Records[0].s3.object.key}?versionId=${data.VersionIdMarker}`
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
                data.forEach((menu_json, i) => {
                    menu_json.items.sort(sort_by_id)
                    menu_json.items.forEach((item, i) => {
                        item.portions.sort(sort_by_id)
                        item.portions.forEach((portion, i) => {
                            if (portion.modifiers) portion.modifiers.sort(sort_by_id)
                        })
                    })

                    menu_json.menus.sort(sort_by_id)
                    menu_json.menus.forEach((menu, i) => {
                        menu.categories.sort(sort_by_id)
                        menu.categories.forEach((cat, i) => {
                            if (cat.item_ids) cat.item_ids.sort(sort_by_id)
                            if (cat.categories) {
                                cat.categories.sort(sort_by_id)
                                cat.categories.forEach((cat, id) => {
                                    cat.item_ids.sort(sort_by_id)
                                })
                            }
                        })
                    })
                })

                let delta = jsondiffpatch.diff(data[0], data[1])
                let nb_items = delta.items ? Object.keys(delta.items).length : 0
                let nb_menus = delta.menus ? Object.keys(delta.menus).length : 0
                let nb_modifiers = delta.modifiers ? Object.keys(delta.modifiers).length : 0

                if (nb_menus || nb_items || nb_modifiers) {
                    var params = {
                        Body: pug.renderFile('diff.pug', {
                            delta: JSON.stringify(delta),
                            left: JSON.stringify(data[0])
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
                                    "text": `New menu publication on \`${event.Records[0].s3.object.key.replace("api/menu/", "")}\` <${menu_one}|before> => <${menu_two}|after> (<http://s3.${region}.amazonaws.com/${bucket}/${event.Records[0].s3.object.key}.diff?versionId=${data.VersionId}|list of updates>)`
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
        } else {
            console.log('first menu version')
            callback()
        }
    });
}
