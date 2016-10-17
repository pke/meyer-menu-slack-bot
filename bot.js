const storage = require("node-persist")
const koa = require("koa")
const moment = require("moment")

//require("./logging")

console.info("Bot started")

const builder = require("botbuilder")
const model = "https://api.projectoxford.ai/luis/v1/application?id=ae8c3d46-7015-4efb-9c40-883688b58782&subscription-key=da0336fd361841699fe89778c43cba48"

function recognizeAync(utterance) {
  return new Promise((c, e) => {
    builder.LuisRecognizer.recognize(utterance, model, (err, intents, entities) => {
      if (err) {
        e(err)
      } else {
        //builder.EntityRecognizer.resolveTime(entities)
        return c({ intents, entities })
      }
    })  
  })
}

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
  this.body = ""

  // Old records had this not saved in this flattend way
  session.customerId = session.customerId || session.customer.customerId
  recognizeAync(this.query.text || "today").then(result => {
    const { intents, entities } = result 
    switch (intents[0].intent) {
    case "getBalance": {
      slackMessage(responseUrl, "Warte, ich schaue mal nach wieviel :euro: Du noch zum Bestellen hast...").send()
      .then(() => (
        getBalanceAsync(session.accessToken)
          .then(function(result) {
            const numberOfMeals = Math.round(result.balance / 3.1)
            let text
            if (!numberOfMeals) {
              text = `Tut mir leid, für die ${formatCurrency(result.balance)}, die Du noch hast, kannst Du nichts mehr bestellen :crying_cat_face:`
            }
            else {
              text = `${firstName(session.customer.name)} Du hast noch ${formatCurrency(result.balance)} zum Bestellen.\nDas reicht für ca. ${numberOfMeals} Menüs.`
            }
            slackMessage(responseUrl, text).send()
          })
      ))
      break
    }
    case "showMenu": {
      const date = moment(builder.EntityRecognizer.resolveTime(entities) || entities[0])
      slackMessage(responseUrl, `Mal sehen was es heute für Dich zu essen gibt, ${firstName(session.customer.name)}...`).send()
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
          nextWeek: "dd",
        })}:` 
        menus.map(menu => {
          slackMessage(responseUrl, text)
          .attachMenu(menu)
          .send()
        })
      })
    }}
  })
})

const server = app.listen(process.env.PORT || 1337, () => {
  const host = server.address().address
  const port = server.address().port  
  console.info("listening and serving lunch at %s:%s", host, port)
})
