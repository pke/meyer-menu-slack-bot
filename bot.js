const storage = require("node-persist")
const express = require("express")
const moment = require("moment")

const { EMPLOYEES } = require("./employees")

const { loginAsync, getBalanceAsync, getMenusForDay } = require("./api")
const { checkSlackToken, message: slackMessage } = require("./slack")

const app = express()
storage.initSync()

/*
  Show/Order flow:
  when show menu for today
  and there is an order
  then show it

  when show menu for today
  and there is no order
  and time is < 05:00
  then show list of menus for today
    
  when show menu for today
  and there is no order
  and time is > 05:00
  then show sorry message

  when show menu for date in future
  and noting was ordered for that date
  then show a list of menus for that date

  when show menu for date in future
  and something was ordered for that date
  and its before 05:00
  then allow user to change her selection
*/

/*
loginAsync("335515", "3437").then(function(session) {
  return getTodaysMenus(session.customer.customerId, session.accessToken)
}).then(function(menus) {
  menus.forEach(function(menu) {
    console.log(menu.menulinie  + ": " + menu.title)
  })
}).catch(function(error) {
  console.error(error)
})
*/


function firstName(name) {
  return name.split(" ")[0]
}


function formatCurrency(amount) {
  return Number(amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

app.post("/action", checkSlackToken, (req, res) => {

})

app.get("/", checkSlackToken, function(req, res) {
  console.log(req.query)
  var userId = req.query.user_id
  var command = req.query.command || "/lunch"
  var session = storage.getItemSync(userId)
  var responseUrl = req.query.response_url

  if (/bier|beer/i.test(req.query.text)) {
    return slackMessage(res, "Bier ab *vier*! :beers:").sendInChannel()
  }
  
  res.send({ text: "Mal sehen was es heute zu essen gibt..." })

  var getSessionAsync = session 
    ? Promise.resolve(session)
    : Promise.reject(new Error("Bitte einmalig anmelden mit `" + command + " login kundennummer [pin]`"))
  var match
  if ((match = /^login\s*(\w+)?\s*(\w+)?$/.exec(req.query.text))) {
    session = null
    var customerId = match[1]
    var pin = match[2]
    if (!customerId) {
      getSessionAsync = Promise.reject(new Error("Keine Kundennummer angegeben."))
    } else {
      if (!pin) {
        EMPLOYEES.some(function(user) {
          if (user.customerId == customerId) {
            pin = user.pin
            return true
          }
        })
      }
    }
    if (!pin && customerId) {
      getSessionAsync = Promise.reject(new Error("Kein Mitarbeiter mit Kundennummer " + customerId + " gefunden. Bitte mit Kundennummer und Pin einloggen"))
    } else if (pin && customerId) {
      getSessionAsync = loginAsync(customerId, pin)
      .then(function(_session) {
        session = _session
        // Save the customerId (which is different for the API calls than the login customerId)
        // It would all be much easier, if API calls would just need the accessToken and
        // not an additional customerId in the URLs
        session.customerId = session.customer.customerId
        return storage.setItem(userId, session)
      }).then(function() {
        return session
      })
    }
  }
  getSessionAsync.then(function(session) {
    // Old records had this not saved in this flattend way
    session.customerId = session.customerId || session.customer.customerId
    if (/balance/.test(req.query.text)) {
      getBalanceAsync(session.accessToken)
      .then(function(result) {
        slackMessage(responseUrl, "Guthaben: " + formatCurrency(result.balance)).send()
      }) 
    } else {
      // this does not work yet, make MS botbuilder work and help us here with date
      // resolution
      let date = moment()
      var when
      const setDays = [ 1, 1, 4, 4, 4, 8, 8 ]
      if ((when = /(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(req.query.text))) {
        switch (when[1]) {
        case "tomorrow": date = date.add(1, "day"); break
        case "monday": date = date.day(setDays[1]); break
        case "tuesday": date = date.day(setDays[2]); break
        case "wednesday": date = date.day(setDays[3]); break
        case "thursday": date = date.day(setDays[4]); break
        case "friday": date = date.day(setDays[5]); break
        case "saturday":
        case "sunday": {
          return slackMessage(responseUrl, "Am Wochende wird doch nicht gearbeitet!").send()
        }
        }
      }
      getMenusForDay(session, date.toDate(), {
        details: /details?/.test(req.query.text) 
      }).then(function(menus) {
        if (!menus.length) {
          return slackMessage(
            responseUrl, 
            `Hmm, heute kann ich irgendwie nicht sehen, dass Du was bestellt hättest, ${firstName(session.customer.name)}. Du kannst ${date.calendar()} leider nicht am Mittagessen teilnehmen :rage:`
          ).send()
        }
        var text = `${firstName(session.customer.name)}, für Dich gibt's ${date.calendar(null, {
          sameDay: "[heute]",
          nextDay: "[morgen]",
          nextWeek: "dddd",
        })}:` 
        menus.map(function(menu) {
          const message = slackMessage(responseUrl, text)
          .attachMenu(menu)
          if (menu.incredients) {
            message.attach({
              title: "Nährwerte",
              fields: menu.incredients.map(function(incredient) {
                return {
                  title: incredient.name,
                  value: `${incredient.amount} ${incredient.unit}`,
                  short: true, 
                }
              }),
            }) 
          }
          message.send()
        })
      })
    }
  }).catch(error => {
    console.error(error)
    if (!session) {
      slackMessage(responseUrl, error.message)
      .attach({
        text: "Diese Mitarbeiter sind bekannt und können sich nur durch login mit der Kundennummer anmelden",
        fields: EMPLOYEES.map(user =>({
          title: user.name,
          value: user.customerId,
          short: true}))
      }).send()
    } else {  
      //res.status(500).send(error.message)
    }
  })
})

var server = app.listen(1337, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("meyer menu bot listening at http://%s:%s", host, port)
})
