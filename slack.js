const fetch = require("isomorphic-fetch")
const { imageUrl } = require("./api")

function postMessage(responseUrl, message) {
  fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8"
    },  
    body: JSON.stringify(message), 
  }).catch(error => {
    console.error("Could not send to %s", responseUrl, { message, error })
  })
}

/**
 * Slack Message Builder
 * 
 * @arg reponseOrURL express Response | string
 * @arg text string
 */
const message = (responseOrURL, text) => {
  let message = {
    text
  }
  return {
    attachMenu(menu) {
      return this.attach({
        title: menu.menulinie + ": " + menu.title,
        text: menu.description,
        imageUrl: imageUrl(menu.menuimage),
        footer: "Guten Appetit!",
      })
    },

    attach({title, text, imageUrl, footer, fields}) {
      const attachment = {
        title, text, image_url: imageUrl, footer, fields,
        mrkdwn_in: ["title", "text", "fields"],
      }
      if (message.attachments) {
        message.attachments.push(attachment)
      } else {
        message.attachments = [attachment]
      }
      return this
    },

    sendInChannel() {
      return this.send("in_channel")
    },

    send(destination) {
      if (destination) {
        message.response_type = destination
      }
      console.info(message)
      if (typeof responseOrURL === "string") {
        postMessage(responseOrURL, message)
      } else {
        responseOrURL.body = message
      }
    }
  }
}


function* checkSlackToken(next) {
  if (["Q4p9aXw3H53vy8gIirlBmITm"].indexOf(this.query.token) == -1) {
    this.status = 401
    this.message = "You are not allowed to ask me anything"
    return
  }
  yield next
}

module.exports = {
  message,
  checkSlackToken,
}