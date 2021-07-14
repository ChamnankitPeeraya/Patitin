//global function for calendar
Date.prototype.addDays = function (days) {
  this.setDate(this.getDate() + days)
  return this
}
Date.prototype.addMonths = function (months) {
  this.setMonth(this.getMonth() + months)
  return this
}

const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');

// Enable .env variables
require('dotenv').config();

const cors = require('cors');

const errorController = require('./controllers/error');
const User = require('./models/user');

// 'mongodb+srv://user:[key here]';
const MONGODB_URI = process.env.MONGODB_URI;

//const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:33017';

const PORT = process.env.PORT || 5000 // So we can run on heroku || (OR) localhost:5000
const HEROKU_CORS = process.env.HEROKU_CORS

// Startup
const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});
const csrfProtection = csrf();

app.set('view engine', 'ejs');
app.set('views', 'views');

//Heroku connection
const corsOptions = {
  origin: HEROKU_CORS,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const options = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  family: 4
};

// const adminRoutes = require('./routes/admin');
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
  })
);
app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  // throw new Error('Sync Dummy');
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch(err => {
      next(new Error(err));
    });
});

// app.use('/admin', adminRoutes);
app.use(homeRoutes);
app.use(authRoutes);
app.use('/events', eventRoutes);

app.get('/500', errorController.get500);

app.use(errorController.get404);

app.use((error, req, res, next) => {
  res.status(500).render('500', {
    pageTitle: 'Error!',
    path: '/500',
    isAuthenticated: req.session.isLoggedIn
  });
});

mongoose
  .connect(MONGODB_URI, options)
  .then(result => {
    const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`))

    const io = require('socket.io')(server)
    io.on('connection', socket => {
      console.log('Client connected!')

      socket
        .on('disconnect', () => {
          console.log('A client disconnected!')
        })
    });
  })
  .catch(err => {
    console.log(err);
  });