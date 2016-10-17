var builder = require("botbuilder")

// Create bot and bind to console
var connector = new builder.ConsoleConnector().listen()
var bot = new builder.UniversalBot(connector)

// Create LUIS recognizer that points at our model and add it as the root '/' dialog for our Cortana Bot.
var model = "https://api.projectoxford.ai/luis/v1/application?id=ae8c3d46-7015-4efb-9c40-883688b58782&subscription-key=da0336fd361841699fe89778c43cba48"
var recognizer = new builder.LuisRecognizer(model)
var dialog = new builder.IntentDialog({ recognizers: [recognizer] })
bot.dialog("/", dialog)

// Add intent handlers
dialog.matches("getBalance", builder.DialogAction.send("Kontostand: 132"))
dialog.matches("showMenu", [
  function (session, args, next) {
    const time = builder.EntityRecognizer.resolveTime(args.entities)
    if (!time) {
      builder.Prompts.text(session, "Which date?")
    } else {
      next()
    }
  },
])
dialog.matches("orderMenu", [
  function (session, args/*, next*/) {
    const menuType = builder.EntityRecognizer.findEntity(args.entities, "menuType")
    session.send(`Ok, ${menuType.entity} it is`)
  }
])
dialog.onDefault(builder.DialogAction.send("I'm sorry I didn't understand. I can only create & delete alarms."))