"use strict";
var app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(router);

app.locals.config = config;

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

app.use(express.static(path.join(__dirname, '/../public')));

module.exports = app;
