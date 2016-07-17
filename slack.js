const fetch = require("isomorphic-fetch")
const { imageUrl } = require("./api")

const postMessage = (responseUrl, message) => (
  fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8"
    },  
    body: JSON.stringify(message), 
  }).catch(error => {
    console.error("Could not send to %s", responseUrl, { message, error })
    throw error
  })
)

const menuAttachment = menu => ({
  title: menu.menulinie + ": " + menu.title,
  text: menu.description,
  imageUrl: imageUrl(menu.menuimage),
  footer: "Guten Appetit!",
})

const menuIncredientAttachment = incredients => ({
  title: "Nährwerte",
  fields: incredients.map(incredient => ({
    title: incredient.name,
    value: `${incredient.amount} ${incredient.unit}`,
    short: true, 
  })),
})

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
      var result = this.attach(menuAttachment(menu))
      if (menu.incredients) {
        result.attach(menuIncredientAttachment(menu.incredients))
      }        
      return result
    },

    attach({title, text, imageUrl, footer, fields}) {
      const attachment = {
        title, text, image_url: imageUrl, footer,
        mrkdwn_in: ["title", "text", "fields"],
      }
      if (fields) {
        attachment.fields = fields
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
        return postMessage(responseOrURL, message)
      } else {
        responseOrURL.body = message
        return Promise.resolve(responseOrURL)
      }
    }
  }
}


function* checkSlackToken(next) {
  if (["Q4p9aXw3H53vy8gIirlBmITm"].indexOf(this.query.token) == -1) {
    this.throw(401, "You are not allowed to ask me anything")
  }
  if (!this.query.user_id) {
    this.throw(401, "No user_id given")
  }
  yield next
}

module.exports = {
  message,
  checkSlackToken,
}