'use strict'

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))
console.log(env)
// require('dotenv').parse(env)

const axios = require('axios')
const moment = require('moment-timezone')
// const { MYSQLClient } = require('MYSQLdb')
const mysql  = require('mysql2')

const MYSQL_HOST = env.MYSQL_HOST || '192.168.1.2'
const MYSQL_PORT = env.MYSQL_PORT || '3306'
const MYSQL_USERID = env.MYSQL_USERID || 'xmr_stak'
const MYSQL_PASSWD = env.MYSQL_PASSWD || 'quQoakBJ'
const MYSQL_DATABASE = env.MYSQL_DATABASE || 'zxmr_stak'
const MYSQL_TABLE = env.MYSQL_TABLE || 'jobs'

const MYSQL_CONNECTION_URL = `MYSQLdb://${MYSQL_USERID}:${MYSQL_PASSWD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`

// Database Pool Connection
var dbc

async function logEvent(event) {
  console.log(event)
}

async function queryAsync(query, params) {
  return new Promise((resolve, reject) =>{
    dbc.query(query, params, (err, result) => {
      if (err)
        return reject(err);
      resolve(result);
    });
  });
}

const prepareDB = async function () {
  // const url = "MYSQLdb://" + env.MYSQL + ":27017/clients"
  return new Promise((resolve, reject) => {
    if (dbc) {
      console.warn("DB already connected.")
      return resolve(dbc)
    }
    console.warn("DB connecting")
    dbc = mysql.createConnection({
      host     : MYSQL_HOST,
      port     : MYSQL_PORT,
      user     : MYSQL_USERID,
      password : MYSQL_PASSWD,
      database : MYSQL_DATABASE
    });
    // dbc.config.queryFormat = function (query, values) {
    //   if (!values) return query;
    //   return query.replace(/\:(\w+)/g, function (txt, key) {
    //     if (values.hasOwnProperty(key)) {
    //       return this.escape(values[key]);
    //     }
    //     return txt;
    //   }.bind(this));
    // };
    dbc.on('connect', logEvent)
    dbc.on('disconnect', logEvent)
    dbc.connect()
    return resolve(dbc)
  })
}

function slog (str) { console.log('MYSQL-job-log: ' + str) }

module.exports = async (event, context) => {

  // /?name=job_name&action=start
  slog('starting...', event)
  // const fn = event.path.replace('/', '')
  // const data = event.body
  // const level = event.query.level || 'info'
  var result // = { test: 'one', event, context }
  const { id, host, name, action } = event.query
  const data = event.body

  try {
    await prepareDB()
    var query
    var timestamp = moment().format('YYYY-MM-DD HH:mm:ss') // .valueOf()

    switch (action) {
      case 'start':
        // query = `INSERT INTO jobs (name, starttime, status) VALUES (:name, :timestamp, :status)`
        // var inserted = await dbc.query(query, { name, timestamp, status: 'started' })
        query = `INSERT INTO jobs (host, name, starttime, status) VALUES ('${host||''}', '${name}', '${timestamp}', 'started')`
        console.log(query)
        const inserted = await queryAsync(query)
        console.log(inserted)
        result = { id: inserted.insertId }
        break
      case 'stop':
        // query = 'UPDATE jobs set status = :status, endtime = :timestamp WHERE id = :id'
        // var updated = await dbc.query(query, {id, timestamp, status: 'done'})
        query = `UPDATE jobs set status = 'done', endtime = '${timestamp}' WHERE id = ${id}`
        console.log(query)
        var updated = await queryAsync(query)
        result = { affectedRows: updated.affectedRows }
        break
      default:
    }
    slog('inserting log record')
  } catch (err) {
    slog('got an error...!')
    console.error(err)
    result = {
      error: err
    }
  }
  slog('done...' + JSON.stringify(result))

  return context
    .status(200)
    .headers({'content-type': 'application/json'})
    .succeed(JSON.stringify(result))
}
