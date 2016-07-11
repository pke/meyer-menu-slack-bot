const fetch = require("isomorphic-fetch")
const moment = require("moment")
// Ensure the week numbers are counted correctly
moment.locale("de-DE")

const API_URL = "https://shop.meyer-menue.de/api/v1"
const ASSET_URL = "https://shop.meyer-menue.de/assets"

const imageUrl = image => `${ASSET_URL}/image/${image}`

const apiDate = date => {
  date = moment(date)
  return {
    date: date,
    year: date.year(),
    week: date.week(),
    day: date.weekday(),
  }
}

const requestAsync = (method, path, data, accessToken) => {
  const headers = Object.assign({}, {
    "Accept": "application/json",
    "Content-Type": "application/json;charset=UTF-8"
  },{ 
    "Access-Token": accessToken
  })
  const url = API_URL + path
  console.log("api: " + url)
  return fetch(url, {
    method,
    body: JSON.stringify(data),
    headers,
  }).then(function(response) {
    if (response.ok) {
      var contentType = response.headers.get("content-type")
      if(contentType && contentType.indexOf("application/json") !== -1) {
        return response.json().then(function(json) {
          return {
            response,
            json,
          }
        })
      }
      throw new TypeError(`Invalid response type for ${url}: ${contentType}`)
    } else {
      throw new Error(`Invalid response for ${path}: ${response.statusText}`)
    }
  })
}

const loginAsync = (customerId, pinCode) => {
  return requestAsync("POST", "/auth/login", { customerId, pinCode })
  .then(function(result) {
    return {
      accessToken: result.response.headers.get("Access-Token"),
      customer: result.json,
    }
  })
}

function toJson(result) {
  return Promise.resolve(result.json)
}

function menusPath(customerId, date) {
  const { year, week } = apiDate(date)
  return `/menue/${customerId}/year/${year}/week/${week}`
}

function getMenusAsync({customerId, accessToken}, date, options) {
  return requestAsync("GET", menusPath(customerId, date), null, accessToken)
  .then(toJson)
  .then(menus => {
    if (options.filter) {
      menus = menus.filter(options.filter)
    }
    if (options.details) {
      return Promise.all(menus.map(menu => (
        getIncredientsAsync(menu, accessToken)
      )))
    } else {
      return menus
    }
  })
}

const dateFilter = date => {
  const dateString = moment(date).format("YYYY-MM-DD")
  return menu => dateString == menu.date && menu.amount
} 

function getMenusForDay(session, date, options) {
  return getMenusAsync(session, date, 
    Object.assign({}, options, {
      filter: dateFilter(date) 
    })
  )
}

const getKnownIncredientsAsync = () => (
  requestAsync("GET", "/ingredients")
  .then(toJson)
  .then(function(json) {
    return json.reduce(function(result, incredient) {
      result[incredient.id] = incredient
      return result
    },{})
  })
)

function resolveIncredients(knownIncredients, menu, incredients) {
  menu.incredients = incredients.reduce(function(result, incredient) {
    let knownIncredient = knownIncredients[incredient.id]
    if (knownIncredient) {
      incredient.name = knownIncredient.title
      incredient.category = knownIncredient.category
      result.push(incredient)
    }
    return result
  }, [])
  return menu
}

const getIncredientsAsync = (menu, accessToken) => {
  const { year, week, day } = apiDate(menu.date)
  var path = `/ingredients/year/${year}/week/${week}/day/${day}/line/${menu.menulinid}`
  return requestAsync("GET", path, null, accessToken)
  .then(toJson)
  .then(incredients => (
    getKnownIncredientsAsync().then(knownIncredients => (
      resolveIncredients(knownIncredients, menu, incredients)
    ))
  ))
}

function orderAsync(customerId, date, menu, amount, accessToken) {
  const { year, week, day } = apiDate(date) 
  return requestAsync("POST", "/orders", {
    customerId,
    line: menu.menulinid,
    week,
    year,
    day,
    price: menu.price,
    amount,
    isInstitutionOrdered: false,
  }, accessToken)
  /*
  [{"customerId":"MzM1NTE1","line":628,"week":28,"year":2016,"day":0,"amount":1,"price":3.1,"isInstitutionOrdered":false},{"customerId":"MzM1NTE1","line":626,"week":28,"year":2016,"day":3,"amount":1,"price":3.1,"isInstitutionOrdered":false},{"customerId":"MzM1NTE1","line":630,"week":28,"year":2016,"day":2,"amount":1,"price":3.1,"isInstitutionOrdered":false},{"customerId":"MzM1NTE1","line":627,"week":28,"year":2016,"day":1,"amount":1,"price":3.1,"isInstitutionOrdered":false},{"customerId":"MzM1NTE1","line":627,"week":28,"year":2016,"day":4,"amount":1,"price":3.1,"isInstitutionOrdered":false}]*/
}

function getBalanceAsync(accessToken) {
  return requestAsync("GET", "/prepaid", null, accessToken)
  .then(toJson)
}

function findDayWithoutMenuAsync(customerId, from, to, accessToken) {
  return getMenusAsync(customerId, from, accessToken)
}

module.exports = {
  loginAsync,
  getBalanceAsync,
  getMenusAsync,
  getMenusForDay,
  orderAsync,
  findDayWithoutMenuAsync,
  imageUrl,
}