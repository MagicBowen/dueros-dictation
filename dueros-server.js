process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
});

const express = require('express');

const Bot = require('./bot');
let app = express();

// 探活请求
app.head('/', (req, res) => {
    res.sendStatus(204);
});

app.post('/', (req, res) => {
    req.rawBody = '';

    req.setEncoding('utf8');
    req.on('data', chunk => {
        req.rawBody += chunk;
    });

    req.on('end', () => {
        let b = new Bot(JSON.parse(req.rawBody));
        // 开启签名认证
        // 本地运行可以先注释
        // b.initCertificate(req.headers, req.rawBody).enableVerifyRequestSign();

        b.run().then(result => {
            res.send(result);
        });
    });
}).listen(8089);

console.log('Dueros course server listen on port 8089');