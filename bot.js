const storage = require("node-persist")
const koa = require("koa")
const moment = require("moment")

require("./logging")

console.info("Bot started")

const { EMPLOYEES } = require("./employees")

const { loginAsync, getBalanceAsync, getMenusForDay } = require("./api")
const { checkSlackToken, message: slackMessage } = require("./slack")

const app = koa()

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

app.use(function* responseTime(next) {
  const start = Date.now()
  yield next
  const duration = Date.now() - start
  this.set("X-Response-Time", duration)
})

app.use(function* requestLogger(next) {
  console.info("%s", this.method, this.query)
  yield next
})

app.use(checkSlackToken)

const addEmployeeDirectory = message => (
  message.attach({
    text: "Diese Mitarbeiter sind bekannt und können sich allein mit der Kundennummer anmelden",
    fields: EMPLOYEES.map(user =>({
      title: user.name,
      value: user.customerId,
      short: true}))
  })
)

app.use(function* publicAccess(next) {
  if (/source/i.test(this.query.text)) {
    return slackMessage(this.response, "https://github.com/pke/meyer-menu-slack-bot").send()
  }

  if (/bier|beer/i.test(this.query.text)) {
    return slackMessage(this.response, "Bier ab *vier*! :beers:").sendInChannel()
  }
  
  const responseUrl = this.query.response_url
  const userId = this.query.user_id
  var match
  if ((match = /^login\s*(\w+)?\s*(\w+)?$/.exec(this.query.text))) {
    this.body = { text: "Anmelden..." }
    var customerId = match[1]
    var pin = match[2]
    if (!customerId) {
      return addEmployeeDirectory(slackMessage(responseUrl, "Keine Kundennummer angegeben.")).send()
    }
    if (!pin) {
      EMPLOYEES.some(user => {
        if (user.customerId == customerId) {
          pin = user.pin
          return true
        }
      })
      if (!pin) {
        return addEmployeeDirectory(slackMessage(responseUrl, `Kein Mitarbeiter mit Kundennummer ${customerId} gefunden. Bitte mit Kundennummer und Pin anmelden`)).send()
      }
    }
    this.state.session = yield loginAsync(customerId, pin)
      .then(session => {        
        // .setItem returns not the `session` but an array of persisted items
        // Each item contains the persist metadata but not the `session` itself
        // Thats why we return the session ourself in the `.then` handler
        return storage.setItem(userId, session)
        .then(() => session)
      })
  }
  yield next
})

app.use(function* getUser(next) {
  if (!this.state.session) {
    const userId = this.query.user_id
    if (!(this.state.session = storage.getItemSync(userId))) {
      this.status = 401
      return addEmployeeDirectory(slackMessage(this.response, "Bitte erst anmelden")).send()
    }
  }
  yield next
})

app.use(function* main(next) {
  yield next
  const session = this.state.session
  const responseUrl = this.query.response_url || this.response
  
  this.status = 200

  // Old records had this not saved in this flattend way
  session.customerId = session.customerId || session.customer.customerId
  if (/balance/.test(this.query.text)) {
    getBalanceAsync(session.accessToken)
    .then(function(result) {
      slackMessage(responseUrl, "Guthaben: " + formatCurrency(result.balance)).send()
    }) 
  } else {
    slackMessage(responseUrl, `Mal sehen was es heute für Dich zu essen gibt, ${firstName(session.customer.name)}...`).send()
    // this does not work yet, make MS botbuilder work and help us here with date
    // resolution
    let date = moment()
    var when
    const setDays = [ 1, 1, 4, 4, 4, 8, 8 ]
    if ((when = /(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(this.query.text))) {
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
      details: /details?/.test(this.query.text) 
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
      menus.map(menu => {
        slackMessage(responseUrl, text)
        .attachMenu(menu)
        .send()
      })
    })
  }
})

const server = app.listen(1337, () => {
  const host = server.address().address
  const port = server.address().port  
  console.info("listening and serving lunch at %s:%s", host, port)
})
