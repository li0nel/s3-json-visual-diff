module.exports = {
    Records:
        [{
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-2',
            eventTime: '2020-10-31T20:57:01.391Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AWS:AIDAIR6N2PTKUBEXLX7XW' },
            requestParameters: { sourceIPAddress: '84.68.11.162' },
            responseElements:
            {
                'x-amz-request-id': 'C45033528AB1A018',
                'x-amz-id-2':
                    'nUEmYEbOHqVRjLUVcTzqigtcJB4KWIloqEOqG5tk9Q5Bw74FF3nV6Lk78QEh4MtHVLtroNyqHaMSPiSOt5woJy0RPsewRvEY'
            },
            s3:
            {
                s3SchemaVersion: '1.0',
                configurationId: 'tf-s3-lambda-20201031203642658600000001',
                bucket:
                {
                    name: 's3jsondiff',
                    ownerIdentity: { principalId: 'A2XPH2QYIC1MI4' },
                    arn: 'arn:aws:s3:::s3jsondiff'
                },
                object:
                {
                    key: 'api/menu/foo.json',
                    size: 221958,
                    eTag: '202bd37498f76bac86ff0bd8f22bafb5',
                    versionId: 'kDxoxVB0u0d1Chta1ZHXHKCfTA4v5dms',
                    sequencer: '005F9DCF9E9449B8D9'
                }
            }
        }]
}