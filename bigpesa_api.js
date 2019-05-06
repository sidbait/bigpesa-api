var cors = require('cors');
async = require('async');
express = require('express');
ejs = require('ejs');
bodyParser = require('body-parser');
request = require("request");
path = require('path');
multer = require('multer');
var redisConnection = require('./app/model/redisConnection');
appDataList = [];
gRankDetails = [];
g15daysRankDetails = [];
gBanners = [];
gTopEvents = [];
gTopPrizeWin = [];
gTopGamePlays = [];
gEventMaster = [];
gTopReferer = [];
gAppList = [];
gTopGameWinners = [];
gValidScores = [];
iIsGlobal = false;
//code require
config = require('config');
router = require('./app/routes');
var dbConnection = require('./app/model/dbConnection');
app = express();
app.use(cors());
var morgan = require('morgan')
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

console.log(config.db_connectionString)
console.log(process.env.NODE_ENV)
//multer setup
/* var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads/');
    },
    filename: function (req, file, cb) {
        //console.log('filename:' + JSON.stringify(file));
        var tmp_file;
        var extension = file.mimetype;
        extension = extension.split('/');
        extension = extension[1];
        tmp_file = Date.now() + "." + extension;
        cb(null, tmp_file);
    }
});

app.use(multer({
    dest: './public/uploads/',
    storage: storage,
    fileFilter: function (req, file, cb) {
        cb(null, true);
    }
}).any()); */

app.use(function (req, res, next) {
    if (typeof req.files == "undefined") {
        req.files = [];
    }
    for (var i = 0; i < req.files.length; i++) {
        req[req.files[i]['fieldname']] = {};
        req[req.files[i]['fieldname']] = req.files[i];
    }
    // Pass to next layer of middleware
    next();
});
//multer setup
//app.use(router);
app.use(morgan(function (tokens, req, res) {
    return [
        tokens.method(req, res),
        tokens.url(req, res),

        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms'
    ].join(' ')
}))

app.use('/app/v1', router);

//Setting max listeners to infinite.
process.setMaxListeners(0);
process.on('uncaughtException', function (err) {
    console.log('uncaughtException:', err.message);
    console.log(err.stack);
});

app.listen(config.app.port, function () {
    console.log('Listening on port:' + config.app.port);
    console.log('Welcome to Bigpesa App');
});


async function DayRank() {
    try {
        console.log('15 Day Rank')
        let RankDetails = await redisConnection.getRedisPromise('g15daysRankDetails');
        if (RankDetails != null) {            
            g15daysRankDetails = JSON.parse(RankDetails);
            console.log('RANK Update ' + g15daysRankDetails.length)
        }
        setTimeout(async() => {
            DayRank();
        }, 60000);
        // let DayRanks = "select * from tbl_contest_rank where contest_id in (select " +
        //     " contest_id from tbl_contest where start_date >  " +
        //     " (now()::timestamptz - (8::int * '1d'::interval)))  order by contest_id,lower_rank   ";
        // dbConnection.executeQuery(DayRanks, 'rmg_db', function (err, dbResult) {
        //     if (dbResult != null) {
        //         g15daysRankDetails = dbResult;
        //         console.log('15DAYS RANK -' + g15daysRankDetails.length)
        //     }   
        //});
    } catch (error) {
        setTimeout(async() => {
            DayRank();
        }, 60000);
    }
}
async function Banners() {
    try {
        console.log('Banners Rank');
        let banners = await redisConnection.getRedisPromise('gBanners');
        if (banners != null) {
            gBanners = JSON.parse(banners);
            console.log('gBanners Update ' + gBanners.length)
        }
      
        setTimeout(async() => {
            Banners();
        }, 1000);
        //     }
        // });
    } catch (error) {
        setTimeout(async() => {
            DayRank();
        }, 60000);
    }
}
async function AppList() {
    try {
        let appList = await redisConnection.getRedisPromise('gAppList');
        if (appList != null) {
            gAppList = JSON.parse(appList);          
            console.log('gAppList Update ' + gAppList.length)
        }
        setTimeout(async() => {
            AppList();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            AppList();
        }, 60000);
    }
 
}
async function TopEventMaster() {
    try {
        let topEvents = await redisConnection.getRedisPromise('gTopEvents');
        if (topEvents != null) {
            gTopEvents = JSON.parse(topEvents);
            console.log('gTopEvents Update ' + gTopEvents.length)
        }
        setTimeout(async() => {
            TopEventMaster();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            TopEventMaster();
        }, 60000); 
    }   
   
}
async function TopPrizeWin() {
    try {
        let topPrizeWin = await redisConnection.getRedisPromise('gTopPrizeWin');
        if (topPrizeWin != null) {
            gTopPrizeWin = JSON.parse(topPrizeWin);
            console.log('gTopPrizeWin Update ' + gTopPrizeWin.length)
        }
        setTimeout(async() => {
            TopPrizeWin();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            TopPrizeWin();
        }, 60000);
    }
   
}
async function TopGamePlays() {
    try {
        let topGamePlays = await redisConnection.getRedisPromise('gTopGamePlays');
        if (topGamePlays != null) {
            gTopGamePlays = JSON.parse(topGamePlays);
            console.log('gTopGamePlays Update ' + gTopGamePlays.length)
        }
        setTimeout(async() => {
            TopGamePlays();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            TopGamePlays();
        }, 60000);
    }   
  
}
async function EventMaster() {
    try {
        let eventMaster = await redisConnection.getRedisPromise('gEventMaster');
        if (eventMaster != null) {
            gEventMaster = JSON.parse(eventMaster);
            console.log('gEventMaster Update ' + gEventMaster.length)
        } setTimeout(async() => {
            EventMaster();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            EventMaster();
        }, 60000);
    }    
    
}
async function TopReferer() {
    try {
        let topReferer = await redisConnection.getRedisPromise('gTopReferer');
        if (topReferer != null) {
            gTopReferer = JSON.parse(topReferer);
            console.log('gTopReferer Update ' + gTopReferer.length)
        }
        setTimeout(async() => {
            TopReferer();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            TopReferer();
        }, 60000);
    }
    
}
async function TopGameWinnerList() {
    try {
        let topGameWinners = await redisConnection.getRedisPromise('gTopGameWinners');
        if (topGameWinners != null) {
            gTopGameWinners = JSON.parse(topGameWinners);
            console.log('gTopGameWinners Update ' + gTopGameWinners.length)
        }
        setTimeout(async() => {
            TopGameWinnerList();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            TopGameWinnerList();
        }, 60000);
    }
    
}
async function tbl_score_validation() {
    try {
        let ValidScores = await redisConnection.getRedisPromise('gValidScores');
        if (ValidScores != null) {
            gValidScores = JSON.parse(ValidScores);
            console.log('gValidScores Update ' + gValidScores.length)
        }
        setTimeout(async() => {
            tbl_score_validation();
        }, 60000);
    } catch (error) {
        setTimeout(async() => {
            tbl_score_validation();
        }, 60000);
    }
   
}


client.on("connect", function (err) {
    console.log('Connected')
    AppList();
    DayRank();
    Banners();
    TopEventMaster();
    TopPrizeWin();
    TopGamePlays();
    EventMaster();
    TopReferer();
    TopGameWinnerList();
    tbl_score_validation();
});

