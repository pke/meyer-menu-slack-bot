const fetch = require("isomorphic-fetch")
const { imageUrl } = require("./api")

function postAsync(responseUrl, message) {
  return fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8"
    },  
    body: JSON.stringify(message), 
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
        message.reponse_type = destination
      }
      console.log(message)
      if (typeof responseOrURL === "string") {
        return postAsync(responseOrURL, message)
      } else {
        return responseOrURL.send(message)
      }
    }
  }
}


function checkSlackToken(req, res, next) {
  if (["Q4p9aXw3H53vy8gIirlBmITm"].indexOf(req.query.token) == -1) {
    return res.status(401).send("You are not allowed to ask me anything")
  }
  next()
}

module.exports = {
  message,
  checkSlackToken,
}