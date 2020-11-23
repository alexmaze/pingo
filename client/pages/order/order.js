const OrderAPI = require("../../apis/order")
const {
  navigateBackOrIndex
} = require("../../utils/util")
const regeneratorRuntime = require("../../utils/runtime");

Page({
  data: {
    id: "",
    readonly: false,
    isLoading: false,
    order: null,

    statusTM: {
      open: "进行中",
      closed: "已结束"
    },
    isAddModalVisiable: false,
    isModifyModalVisiable: false,
    modifyProduct: null,
    modifyProductIndex: -1
  },

  onReady: function () {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },
  onLoad: function (options) {
    this.setData({
      "id": options.id
    })
  },
  onShow: function () {
    this.refresh()
  },
  onPullDownRefresh: function () {
    this.refresh()
  },

  refresh: async function () {
    // wx.showLoading()
    this.setData({
      isLoading: true
    })

    try {
      const order = await OrderAPI.show(this.data.id)
      const readonly = order.status === "closed"

      let total = 0
      for (const p of order.products) {
        for (const m of p.members) {
          total += m.buy_number * p.unit_price
        }
      }
      order.total = parseFloat(total.toFixed(4))

      this.setData({
        order,
        readonly
      })
    } catch (error) {
      console.log(error)
    }

    this.setData({
      isLoading: false
    })
    wx.stopPullDownRefresh({
      success: (res) => { },
    })
    // wx.hideLoading()
  },

  handleClose: function () {
    wx.showModal({
      title: "您确定要结束此次拼购吗？结束后无法编辑。",
      success: async ({
        confirm
      }) => {
        if (!confirm) {
          return
        }

        try {
          wx.showLoading()
          await OrderAPI.close(this.data.id)
          navigateBackOrIndex()
        } catch (err) {
          console.log(err)
          wx.showToast({
            title: '关闭失败',
          })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  handleExportOrder: async function () {
    let data
    try {
      data = await OrderAPI.export(this.data.id)
    } catch (err) {
      console.log(err)
      wx.showToast({
        icon: "none",
        title: '导出失败',
      })
    }
    console.log(data)

    const fileName = `拼购_${this.data.order.title}_${new Date().getTime()}.csv`

    const fm = wx.getFileSystemManager()
    const filePath = wx.env.USER_DATA_PATH + "/" + fileName
    console.log(filePath)
    fm.writeFile({
      data,
      filePath,
      encoding: "utf-8",
      success: (r) => {
        wx.showToast({
          title: '导出成功',
        })

        wx.openDocument({
          filePath,
          showMenu: true,
          fileType: "xls",
          success: () => {
            console.log("打开成功")
          },
          fail: err => {
            console.log("打开失败", err)
          }
        })
      },
      fail: () => {
        wx.showToast({
          title: '导出失败',
          icon: "none"
        })
      }
    })

  },

  // 新增商品模态框
  handleAddProduct: function () {
    this.setData({
      isAddModalVisiable: true
    })
  },
  handleCloseAddModal: function () {
    this.setData({
      isAddModalVisiable: false
    })
  },
  handleSubmitAddModal: async function (v) {
    this.setData({
      isAddModalVisiable: false
    })
    this.data.order.products.push(v.detail)
    this.setData({
      "order.products": this.data.order.products
    })

    if (this.data.id) {
      this.setData({
        isLoading: true
      })
      // wx.showLoading()
      try {
        await OrderAPI.addProduct(this.data.id, v.detail)
      } catch (err) {
        console.error(err)
        wx.showToast({
          title: err,
        })
      }
      // wx.hideLoading()
      this.setData({
        isLoading: false
      })
      this.refresh()
    }
  },

  // 处理产品数据更新
  handleTapProductCard: function (v) {
    if (this.data.order.status !== "open") {
      return
    }
    const product = this.data.order.products[v.target.dataset.index]
    this.setData({
      modifyProduct: product,
      modifyProductIndex: v.target.dataset.index,
      isModifyModalVisiable: true
    })
  },
  handleCloseModifyModal: function () {
    this.setData({
      isModifyModalVisiable: false
    })
  },
  handleSubmitModifyModal: async function (v) {
    this.setData({
      isModifyModalVisiable: false
    })

    try {
      this.setData({
        isLoading: true
      })
      // wx.showLoading()
      await OrderAPI.updateProductInfo(this.data.id, v.detail.id, v.detail)
      await OrderAPI.updateMyProductSelectNumber(this.data.id, v.detail.id, v.detail._my_number)
    } catch (error) {
      console.error(error)
      wx.showToast({
        title: error,
      })
    }
    this.setData({
      isLoading: false
    })
    // wx.hideLoading()
    this.refresh()
  },
  handleDeleteModifyModal: async function (v) {
    const p = v.detail
    if (p.members && p.members.length > 0) {
      wx.showToast({
        icon: "none",
        title: '商品已经有人订购，删除前需要联系对方取消订购',
      })
      return
    }

    this.setData({
      isModifyModalVisiable: false
    })

    // 订单 ID 商品 ID
    await OrderAPI.deleteProduct(this.data.order.id, v.detail.id)
    this.refresh()
  }
})