var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json({
    limit: '5mb',
    extended: true
}));
app.use(bodyParser.urlencoded({
    limit: '5mb',
    extended: true
}));

/** MYSQL SETUP */
const mysql = require('mysql');
/* LOCAL CONNECTION */
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', database: 'salesorderhelper'
});

/** REMOTE CONNECTION  */
// const con = mysql.createConnection({
//     host: 'xxx.xxx.xxx.xxx',
//     // port: '9999',
//     user: '<user_name>',
//     password: '<password>',
//     database: '<database_name>'
// });

con.connect((err) => {
    if (err) {
        console.log('Error connecting to Db');
        console.log(err);
        throw err;
    }
    console.log("Connection Established.");
});
/* FILE UPLOAD CONFIGURATION */
var multer = require('multer');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "_" + file.originalname);
    }
});
var upload = multer({
    storage: storage
});

/** ROUTINGS */
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/upload-file", (req, res) => {
    res.sendFile(__dirname + "/public/upload.html");
});

app.post("/upload-file", upload.single('myFile'), function (req, res) {
    // console.log(req.file);

    var fileNameArray = req.file.originalname.toString().split(".");
    var fileExtension = fileNameArray[fileNameArray.length - 1].toString();

    if (fileExtension.toLowerCase() == "xlsx" || fileExtension.toLowerCase() == "xls" || fileExtension.toLowerCase == "xlsm") {

        var XLSX = require('xlsx');
        var workbook = XLSX.readFile(req.file.destination + req.file.filename);
        var sheet_name_list = workbook.SheetNames;
        var excelJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
        console.log(excelJson);
        var values = [];
        for (var i = 0; i < excelJson.length; i++) {
            var arrPush = [];
            for (var property in excelJson[i]) {
                arrPush.push(excelJson[i][property]);
            }
            // values.push([excelJson[i].brand, excelJson[i].generic, excelJson[i].qty]);
            values.push(arrPush);
        }
        // res.json(values);
        con.query('DELETE FROM excel_upload', (err, result) => {
            if (err) throw err;

            console.log(`Deleted ${result.affectedRows} row(s)`);

            var sql = "INSERT INTO excel_upload (BRAND, GENERIC, QTY) VALUES ?";
            var query = con.query(sql, [values], function (err, result) {
                if (err) throw err;

                console.log(result.affectedRows + ' row(s) inserted.');
                res.redirect('./');
            });
        });

    } else {
        res.send("File format should be xls or xlsx.");
    }
});

app.get('/excel-upload-data', (req, res) => {
    con.query('select BRAND, GENERIC, QTY FROM excel_upload', (err, rows) => {
        if (err) throw err;
        res.json(rows);
    });
});

function compare(a, b) {
    if (a.size < b.size)
        return 1;
    if (a.size > b.size)
        return -1;
    return 0;
}

function hasNumber(myString) {
    return /\d/.test(myString);
}
app.get('/suggestions/item-master/:searchText', (req, res) => {
    var str = req.params.searchText;
    var whereAppend = "WHERE ";
    var keywords = str.split(" ");
    var keyArr = [];
    for (var i = 0; i < keywords.length; i++) {
        keyArr.push({
            word: keywords[i],
            size: keywords[i].length
        });
    }
    keyArr.sort(compare);
    if (keyArr[0].size <= 4) {

    } else {
        for (var i = 0; i < keyArr.length; i++) {
            if (keyArr[i].size <= 4) {
                break;
            }
            if (hasNumber(keyArr[i].word)) {
                continue;
            }
            whereAppend = whereAppend + "NAME like '%" + keyArr[i].word + "%' OR ";
        }
        whereAppend = whereAppend + "1=2";
    }
    // console.log(whereAppend);
    con.query("SELECT * FROM item_master " + whereAppend, (err, rows) => {
        // console.log(rows);
        res.json(rows);
    });
});

app.get('/suggestions/order/:brand/:generic', (req, res) => {
    var condition = 'and';
    var qry = `SELECT I.* FROM order_line_vw A INNER JOIN item_master I  on (A.ITEM_ID = I.ITEM_ID)
    where (A.BRAND = '` + req.params.brand + `' ` + condition + ` A.GENERIC = '` + req.params.generic + `')
    AND A.order_id = (SELECT MAX(B.order_id) from order_line_vw B where A.BRAND = B.BRAND AND A.GENERIC = B.GENERIC)`;

    con.query(qry, (err, rows) => {
        if (rows.length > 0) {
            res.json(rows);
        } else {
            condition = 'or';
            con.query(qry, (err, rows) => {
                res.json(rows);
            });
        }
    });
});

app.get('/items/autocomplete/', (req, res) => {
    con.query("SELECT NAME FROM item_master", (err, rows) => {
        var data = {};
        for (var i = 0; i < rows.length; i++) {
            data[rows[i].NAME] = null;
        }
        res.json(data);
    });
});
app.post('/insertItem', (req, res) => {
    console.log(req.body);
    var item = req.body;
    con.query('SELECT ITEM_ID FROM config', (err, rows) => {
        if (err) throw err;
        var itemId = rows[0].ITEM_ID;
        itemId = itemId + 1;

        item.ITEM_ID = 'SOH_' + itemId;
        values = [
            [
                [item.ITEM_ID, item.NAME, item.UNIT, item.PACKING, item.VENDOR]
            ]
        ];
        con.query('INSERT INTO item_master (ITEM_ID, NAME, UNIT, PACKING, VENDOR) VALUES ?', values, (err, insertItemResult) => {
            if (err) throw err;

            con.query('UPDATE config SET ITEM_ID = ' + itemId, (err, insertIdResult) => {
                if (err) throw err;

                res.json(item);
            });
        });
    });
});

app.post('/modifyItem', (req, res) => {
    var sql = `UPDATE item_master
        SET NAME = ?, UNIT = ? , PACKING = ?, VENDOR = ?
        WHERE ITEM_ID = '` + req.body.ITEM_ID + `'`;
    var binds = [req.body.NAME, req.body.UNIT, req.body.PACKING, req.body.VENDOR];

    con.query(sql, binds, (err, rows) => {
        if (err) throw err;

        res.json(rows);
    });
});
app.post('/saveOrder', (req, res) => {
    var order = req.body;
    var sql;
    if (order.UPDATE_MODE == true) {
        sql = "UPDATE order_hdr SET DATE = ?, COMPANY = ? WHERE ORDER_ID = ?";
        values = [order.DATE, order.COMPANY, order.ORDER_ID];
    } else {
        sql = "INSERT INTO order_hdr (DATE, COMPANY) VALUES ?";
        values = [
            [
                [order.DATE, order.COMPANY]
            ]
        ];
        con.query("DELETE FROM excel_upload", (err, deleteResultExcelUpload) => {
            if (err) throw err;
        });
    }
    con.query(sql, values, function (err, result) {
        var lines = [];
        var tempArr = [];
        var count = 0;
        var suggestionsFound = false;
        if (order.UPDATE_MODE == false) {
            order.ORDER_ID = result.insertId;
        }
        con.query("DELETE FROM order_line WHERE ORDER_ID = ?", [order.ORDER_ID], (err, deleteResult) => {
            if (err) throw err;

            for (var i = 0; i < order.DATA.length; i++) {
                count = 1;
                suggestionsFound = false;
                for (var j = 0; j < order.DATA[i].suggestions.length; j++) {
                    if (order.DATA[i].suggestions[j].selected == true) {
                        tempArr.push(order.ORDER_ID);
                        tempArr.push((i + 1));
                        tempArr.push(order.DATA[i].BRAND);
                        tempArr.push(order.DATA[i].GENERIC);
                        tempArr.push(order.DATA[i].QTY);
                        tempArr.push(count);
                        tempArr.push(order.DATA[i].suggestions[j].ITEM_ID);
                        tempArr.push(order.DATA[i].suggestions[j].QTY);
                        tempArr.push(order.DATA[i].suggestions[j].VENDOR);
                        tempArr.push(order.DATA[i].suggestions[j].SOURCE);
                        count = count + 1;
                        suggestionsFound = true;
                        lines.push(tempArr);
                        tempArr = [];
                    }
                }
                if (suggestionsFound == false) {
                    tempArr.push(order.ORDER_ID);
                    tempArr.push((i + 1));
                    tempArr.push(order.DATA[i].BRAND);
                    tempArr.push(order.DATA[i].GENERIC);
                    tempArr.push(order.DATA[i].QTY);
                    tempArr.push(count);
                    tempArr.push('');
                    tempArr.push(0);
                    tempArr.push('');
                    tempArr.push('');
                    lines.push(tempArr);
                    tempArr = [];
                }

            }

            sql = "INSERT INTO order_line (ORDER_ID, LINE_NUM, BRAND, GENERIC, ORDER_QTY, SELECT_NUM, ITEM_ID, QTY, VENDOR, SOURCE) VALUES ?";

            con.query(sql, [lines], function (err, rows) {
                if (err) throw err;
                order.UPDATE_MODE = true;
                res.json(order);
            });
        });
    });
});

app.get('/order/list', (req, res) => {
    con.query('SELECT * FROM order_hdr', (err, rows) => {
        if (err) throw err;
        res.json(rows);
    });
});

function converOrderLineToDesired(lineResult) {
    var dataArr = [];
    var dataObj = {};
    var prevLineNum = -1;
    for (var i = 0; i < lineResult.length; i++) {
        if (prevLineNum != lineResult[i].LINE_NUM) {
            if (i != 0) {
                dataArr.push(dataObj);
            }
            dataObj = {
                BRAND: lineResult[i].BRAND,
                GENERIC: lineResult[i].GENERIC,
                QTY: lineResult[i].ORDER_QTY,
                suggestions: []
            }
            prevLineNum = lineResult[i].LINE_NUM;
        }

        if (lineResult[i].ITEM_ID != "") {
            dataObj.suggestions.push({
                ITEM_ID: lineResult[i].ITEM_ID,
                NAME: lineResult[i].NAME,
                PACKING: lineResult[i].PACKING,
                QTY: lineResult[i].QTY,
                SOURCE: lineResult[i].SOURCE,
                UNIT: lineResult[i].UNIT,
                VENDOR: lineResult[i].VENDOR,
                selected: true
            });
        }

    }

    return dataArr;
}
app.get('/order/:order_id', (req, res) => {
    var orderId = req.params.order_id;
    con.query('SELECT * FROM order_hdr WHERE ORDER_ID = ?', [orderId], (err, headerResult) => {
        if (err) throw err;
        con.query('SELECT * FROM order_line_vw WHERE ORDER_ID = ?', [orderId], (err, lineResult) => {
            headerResult[0].DATA = converOrderLineToDesired(lineResult);
            headerResult[0].UPDATE_MODE = true;
            res.json(headerResult[0]);
        });
    });
});

app.get('/recentOrder', (req, res) => {
    con.query('SELECT * FROM order_hdr WHERE ORDER_ID = (SELECT MAX(ORDER_ID) FROM order_hdr)', (err, headerResult) => {
        if (err) throw console.log(err);
        con.query('SELECT * FROM order_line_vw WHERE ORDER_ID = ?', [headerResult[0].ORDER_ID], (err, lineResult) => {
            headerResult[0].DATA = converOrderLineToDesired(lineResult);
            headerResult[0].UPDATE_MODE = true;
            res.json(headerResult[0]);
        });
    });
});

var xl = require('excel4node');
app.get('/report/:orderId/:vendor', (req, res) => {
    var xl = require('excel4node');
    var wb = new xl.Workbook();

    // Add Worksheets to the workbook
    var ws = wb.addWorksheet('Sheet 1');

    // // Create a reusable style
    // var style = wb.createStyle({
    //     font: {
    //         color: '#FF0800',
    //         size: 12
    //     },
    //     numberFormat: '$#,##0.00; ($#,##0.00); -'
    // });
    // ws.cell(1, 1).number(100);
    // ws.cell(1, 2).number(200);
    // ws.cell(1, 3).formula('A1 + B1');
    // ws.cell(2, 1).string('string');
    // ws.cell(3, 1).bool(true);

    con.query("SELECT * FROM order_line_vw where VENDOR LIKE '" + req.params.vendor + "%'", (err, rows) => {
        console.log(rows);
    });
    wb.write('Excel.xlsx', res);
});

app.set('port', (process.env.PORT || 5000));

/** LISTENING PORT */
app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});