const express= require('express');
const cors=require('cors');
const helmet= require('helmet');
const morgan=require('morgan');
const raleLimit= require('express-rate-limit');
const connectDB=require('./config/database');
const errorHandler=require('./middleware/errorHandler');

const app= express();
connectDB();
app.use(helmet());
app.use(cors({
    origin:process.env.CLIENT_URL ||'http:localhost:3000',
    credentials:true
}));
//rate limiter
const limiter=ratelimiter({
    windowsMs:15*60*1000,// 15minutes
    max:100,
    message:'Too many requests from this IP, please try again later'

});
app.use('/api', limiter);
//body parsing
app.use(express.json({limit :'10mb'}));
app.use(express.urlencoded({extended:true}));
//logging
app.use(morgan('combined'));
//routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/urls', require('./routes/urls'));
app.use('/api/analytics', require('./routes/analytics'));
//redirect
app.get('/:shortCode', require('./controllers/urlController').redirectUrl);
//healthceck
app.get('/api', (req, res)=>{
    res.json({
        status:'OK', timestamp:new Date().toISOString()
    });

});
//error handling
app.use(errorHandler);
app.use('*', (req, res)=>{res.status(404).json({message:'Route Not Found'});
});

module.exports=app;