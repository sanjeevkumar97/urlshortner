const express=require('express');
const app=express();
const shortid = require('shortid');
const mongoose=require('mongoose');
const path=require('path');


const cookieParser = require("cookie-parser");



const { v4: uuidv4 } = require("uuid");

const {setUser,getUser}=require('./services/auth');

//connectios
mongoose.connect("mongodb://127.0.0.1:27017/urlshortner").then(console.log("mongodb connected"));

//Schema

const urlSchema=new mongoose.Schema({
    urlId:{
        type:String,
        required:true,
        unique:true
    },
    url:{
        type:String,
        required:true
    },

    urlclick:[{timestamp:{type:Number}}],
    createdBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
    }   

},{timestamps:true});

const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
        unique:true
    }
})

const urlModel=mongoose.model("url",urlSchema);
const userModel=mongoose.model("user",userSchema);


app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());
app.set("view engine","ejs");
app.set("views",path.resolve("./views"));

async function checkAuth(req,res,next){
     const sessionId=req.cookies?.sessionId;

    
    const user=getUser(sessionId);
 
    req.user=user;
    next();
}
    


//cousme middleware
function restrictToLoggedInUsers(req,res,next){
      
    const sessionId=req.cookies?.sessionId;

    if(!sessionId){
        return res.redirect('/user/login');
    }
    const user=getUser(sessionId);
    if(!user){
        return res.redirect('/user/login');
    }   
   
    req.user=user;
    next();
}

app.get("/",checkAuth,async(req,res)=>{
    if(!req.user){
        return res.redirect('/user/login');
    }
    const urlData=await urlModel.find({createdBy:req.user._id});
    
    res.render('home',{allUrls:urlData});
})

app.post("/",restrictToLoggedInUsers,async(req,res)=>{
    const body=req.body;

    if(!body.url){
        return res.status(400).json({error:"url is required"});
    }
     const shortId=shortid();
    const newUrl=await urlModel.create({
        urlId:shortId,
        url:body.url,
        createdBy:req.user._id
    });

return res.render('home',{id:shortId})

})


app.get("/:urlId",async(req,res)=>{
    
    const urlId=req.params.urlId;
    const urlData=await urlModel.findOneAndUpdate(
        {urlId},
        {
        $push:{
            urlclick:{timestamp:Date.now()},
        },
       }
     );
    if(!urlData){
        return res.status(404).json({error:"URL not found"});
    }
    return res.redirect(urlData.url);
})


//Authentication routes

app.get("/user/signup",(req,res)=>{
      return res.render('signup');
})


app.post("/user/signup",async(req,res)=>{
 await userModel.create({
    name:req.body.username,
    email:req.body.email,
    password:req.body.password,
 })

 return res.redirect('/');
})

app.get("/user/login",(req,res)=>{
    return res.render('login');
})
app.post("/user/login",async(req,res)=>{
    const {email,password}=req.body;
    const user=await userModel.findOne({email,password});
    if(!user){
        return res.status(404).render('login',{error:"user not found"});
    }

    
   
    const token=setUser(user);
    res.cookie("sessionId",token)
    return res.redirect('/');        
})

app.listen(8001,()=>{
    console.log("server is running on port 8001");
})

