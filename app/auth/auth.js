var express = require('express');
var cookieparser = require('cookie-parser');
var config = require('config');
var logger = require('tracer').colorConsole();

var utility = require('../model/utility');
var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');

module.exports = {
    Authenticate: function (req, res, next) {
        // logger.info(req.session.allow)
        // if (req.session.allow == undefined) {
        //     res.redirect("/user/error");
        // } else {
        //     return next();
        // }
        return next();
    },

    validateLogin: function (req, res, next) {

        logger.info(req.session.allow)

        if (typeof req.signedCookies[utility.CookieNameToMD5("Profile")] !== 'undefined') {
            return next();
        }
        else {
            res.redirect("/user/signIn");
        }
    },

    validateAppReq: function (req, res, next) {
        console.log(req.headers)
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var checkSum = req.headers["checksum"];

        if (appSecretKey == null || appSecretKey == undefined || appSecretKey == '') {
             sendResp.sendCustomJSON(null, req, res, false, [], "Please provide app secret key!")
        }      
        else {
            isAppValid = false;
            gAppList.forEach(app => {
                if(app.app_secret == appSecretKey){
                    isAppValid =true;
                    req.headers.app = app.app_id;
                    req.headers.max_game_minute = app.max_game_minute;
                }
            });
            if(isAppValid){
                next();
            }else{
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid app secret key")
            }            
        }
    },
    AuthorizationCheck: function (req, res, next) {      
        var appSecretKey = req.headers["authorization"];
        if (appSecretKey == null || appSecretKey == undefined || appSecretKey == '') {
            sendResp.sendCustomJSON(null, req, res, false, [], "Please provide Authorization key!")
       }
       else{
        return  next();
       }      
    },
}