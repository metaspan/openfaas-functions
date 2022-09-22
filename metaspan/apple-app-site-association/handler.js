'use strict'

module.exports = async (event, context) => {

  // https://github.com/nativescript-community/universal-links
  const result = {
    "applinks": {
      "apps": [],
      "details": [
        // {
        //   "appID": "TEAM_ID.BUNDLE_ID", // ex: "9JA89QQLNQ.com.apple.wwdc"
        //   "paths": [ "/blog/*"]
        // },
        {
          appID: 'com.metaspan.metawallet',
          paths: ['metaspan://*']
        }
      ]
    }
  }

  return context
    .status(200)
    .headers({'content-type': 'text/json'})
    .succeed(result)
}
