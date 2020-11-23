// components/ProductCard.js
const regeneratorRuntime = require("../utils/runtime");
Component({
  properties: {
    index: {
      type: Number,
      value: true
    },
    data: {
      type: Object,
      value: {}
    }
  },

  data: {
    totalNumber: 0,
    totalPrice: 0
  },

  methods: {
    handleShowMember: function(e) {
      const m = this.properties.data.members[e.currentTarget.dataset.index]
      wx.showModal({
        title: m.account.name || `微信用户${m.account.wx_open_id}`,
        content: `买了 ${m.buy_number} 件，共计 ${m.buy_number * this.properties.data.unit_price} 元`,
        showCancel: false
      })
    }
  },

  observers: {
    "data": function(d) {
      if (!d || !d.members) {
        return
      }
      let totalNumber = 0
      for (const m of d.members) {
        totalNumber += m.buy_number
      }
      totalNumber = parseFloat(totalNumber.toFixed(4))

      this.setData({
        "totalNumber": totalNumber,
        "totalPrice": parseFloat((totalNumber * d.unit_price).toFixed(4))
      })
    }
  }
})
