"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var querystring = require("querystring");
var constants = require("../../../constant");
var Events = require("./Events");
var httpClient = require("./httpClient");
var lodash_1 = require("lodash");
var request = require("requestretry");
var events_1 = require("events");
var environments = {
    sandbox: {
        restHost: 'api-sandbox.oanda.com',
        streamHost: 'stream-sandbox.oanda.com',
        secure: false
    },
    practice: {
        restHost: 'api-fxpractice.oanda.com',
        streamHost: 'stream-fxpractice.oanda.com',
        secure: true
    },
    live: {
        restHost: 'api-fxtrade.oanda.com',
        streamHost: 'stream-fxtrade.oanda.com',
        secure: true
    }
};
var maxSockets = 3, maxRequestsPerSecond = 15, maxRequestsWarningThreshold = 1000;
/*
 * config.environment
 * config.accessToken
 * config.username (Sandbox only)
 */
var OandaAdapter = /** @class */ (function (_super) {
    __extends(OandaAdapter, _super);
    function OandaAdapter(config) {
        var _this = _super.call(this) || this;
        config.environment = config.environment || 'practice';
        // this.accountId = accountId;
        _this.accessToken = config.accessToken;
        _this.restHost = environments[config.environment].restHost;
        _this.streamHost = environments[config.environment].streamHost;
        _this.secure = environments[config.environment].secure;
        if (config.environment === 'sandbox') {
            _this.username = config.username;
        }
        httpClient.setMaxSockets(maxSockets);
        _this.subscriptions = {};
        _this._eventsBuffer = [];
        _this._pricesBuffer = [];
        return _this;
        // this._sendRESTRequest = utils.rateLimit(this._sendRESTRequest, this, 1000 / maxRequestsPerSecond, maxRequestsWarningThreshold);
    }
    return OandaAdapter;
}(events_1.EventEmitter));
exports.OandaAdapter = OandaAdapter;
Events.mixin(OandaAdapter.prototype);
/*
 * Subscribes to events for all accounts authorized by the token
 */
OandaAdapter.prototype.subscribeEvents = function (listener, context) {
    var existingSubscriptions = this.getHandlers('event');
    this.removeListener('event', listener, context);
    this.on('event', listener, context);
    if (existingSubscriptions.length === 0) {
        this._streamEvents();
    }
};
OandaAdapter.prototype.unsubscribeEvents = function (listener, context) {
    this.removeListener('event', listener, context);
    this._streamEvents();
};
OandaAdapter.prototype._streamEvents = function () {
    var subscriptionCount = this.getHandlers('event').length;
    if (this.eventsRequest) {
        this.eventsRequest.abort();
    }
    if (subscriptionCount === 0) {
        return;
    }
    clearTimeout(this.eventsTimeout);
    this.eventsTimeout = setTimeout(this._eventsHeartbeatTimeout.bind(this), 20000);
    this.eventsRequest = httpClient.sendRequest({
        hostname: this.streamHost,
        method: 'GET',
        path: '/v1/events',
        headers: {
            Authorization: 'Bearer ' + this.accessToken,
            Connection: 'Keep-Alive'
        },
        secure: this.secure
    }, this._onEventsResponse.bind(this), this._onEventsData.bind(this));
};
OandaAdapter.prototype._onEventsResponse = function (body, statusCode) {
    if (statusCode !== 200) {
        if (body && body.disconnect) {
            this.emit('message', null, 'Events streaming API disconnected.\nOanda code ' + body.disconnect.code + ': ' + body.disconnect.message);
            // ***** CUSTOM *****
            this.emit('error', {
                code: constants.BROKER_ERROR_DISCONNECT,
                brokerCode: body.disconnect.code,
                message: body.disconnect.message
            });
        }
        else {
            this.emit('message', null, 'Events streaming API disconnected with status ' + statusCode);
            // ***** CUSTOM *****
            this.emit('error', {
                code: constants.BROKER_ERROR_DISCONNECT,
                httpCode: statusCode
            });
        }
    }
    clearTimeout(this.eventsTimeout);
    this.eventsTimeout = setTimeout(this._eventsHeartbeatTimeout.bind(this), 20000);
};
OandaAdapter.prototype._onEventsData = function (data) {
    var _this = this;
    // Single chunks sometimes contain more than one event. Each always end with /r/n. Whole chunk therefore not JSON parsable, so must split.
    // Also, an event may be split accross data chunks, so must buffer.
    // console.log(data.toString());
    data.toString().split(/\r\n/).forEach(function (line) {
        var update;
        if (line) {
            _this._eventsBuffer.push(line);
            try {
                update = JSON.parse(_this._eventsBuffer.join(''));
            }
            catch (error) {
                if (_this._eventsBuffer.length <= 5) {
                    // Wait for next line.
                    return;
                }
                _this.emit('error', {
                    code: constants.BROKER_ERROR_PARSE,
                    message: "Unable to parse Oanda events subscription update. \n \n Error: \n " + error
                });
                _this._eventsBuffer = [];
                return;
            }
            _this._eventsBuffer = [];
            if (update.heartbeat) {
                clearTimeout(_this.eventsTimeout);
                _this.eventsTimeout = setTimeout(_this._eventsHeartbeatTimeout.bind(_this), 20000);
                return;
            }
            _this.emit('event', update);
        }
    }, this);
};
OandaAdapter.prototype._eventsHeartbeatTimeout = function () {
    console.warn('[WARN] OandaAdapter: No heartbeat received from events stream for 20 seconds. Reconnecting.');
    this._streamEvents();
};
OandaAdapter.prototype.getAccounts = function (callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/accounts' + (this.username ? '?username=' + this.username : '')
    }, function (err, body) {
        if (err)
            return callback(err);
        callback(null, body.accounts);
    });
};
OandaAdapter.prototype.getAccount = function (accountId, callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/accounts/' + accountId
    }, function (err, body) {
        if (err)
            return callback(err);
        callback(null, body);
    });
};
OandaAdapter.prototype.getInstruments = function (accountId, callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/instruments?accountId=' + accountId + '&fields=' + ['instrument', 'displayName', 'pip', 'maxTradeUnits', 'precision', 'maxTrailingStop', 'minTrailingStop', 'marginRate', 'halted'].join('%2C'),
    }, function (err, body) {
        if (err)
            return callback(err);
        // callback('Error blablabla');
        callback(null, body.instruments);
    });
};
OandaAdapter.prototype.getPrices = function (symbol, callback) {
    var multiple = Array.isArray(symbol);
    if (multiple)
        symbol = symbol.join('%2C');
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/prices?instruments=' + symbol
    }, function (err, body) {
        if (body && body.prices[0]) {
            callback(null, multiple ? body.prices : body.prices[0]);
        }
        else {
            callback('Unexpected price response for ' + symbol);
        }
    });
};
OandaAdapter.prototype.subscribePrices = function (accountId, symbols, listener) {
    var _this = this;
    symbols.forEach(function (symbol) {
        var existingSubscriptions = _this.getHandlers('price/' + symbol);
        // Price stream needs an accountId to be passed for streaming prices, though prices for a connection are same anyway
        if (!_this.streamPrices) {
            _this.streamPrices = lodash_1.throttle(_this._streamPrices.bind(_this, accountId));
        }
        _this.removeListener('price/' + symbol, listener);
        _this.on('price/' + symbol, listener);
        if (!existingSubscriptions.length)
            _this.streamPrices();
    });
};
OandaAdapter.prototype.unsubscribePrices = function (symbol, listener, context) {
    this.removeListener('price/' + symbol, listener, context);
};
// Kills rates streaming keep alive request for account and creates a new one whenever subsciption list changes. Should always be throttled.
OandaAdapter.prototype._streamPrices = function (accountId) {
    var changed;
    this.priceSubscriptions = Object.keys(this.getHandlers()).reduce(function (memo, event) {
        var match = event.match('^price/(.+)$');
        if (match) {
            memo.push(match[1]);
        }
        return memo;
    }, []).sort().join('%2C');
    changed = !this.lastPriceSubscriptions || this.priceSubscriptions !== this.lastPriceSubscriptions;
    this.lastPriceSubscriptions = this.priceSubscriptions;
    if (!changed) {
        return;
    }
    if (this.pricesRequest) {
        this.pricesRequest.abort();
    }
    if (this.priceSubscriptions === '') {
        return;
    }
    clearTimeout(this.pricesTimeout);
    this.pricesTimeout = setTimeout(this._pricesHeartbeatTimeout.bind(this), 10000);
    this.pricesRequest = httpClient.sendRequest({
        hostname: this.streamHost,
        method: 'GET',
        path: '/v1/prices?accountId=' + accountId + '&instruments=' + this.priceSubscriptions,
        headers: {
            Authorization: 'Bearer ' + this.accessToken,
            Connection: 'Keep-Alive'
        },
        secure: this.secure
    }, this._onPricesResponse.bind(this, accountId), this._onPricesData.bind(this));
};
OandaAdapter.prototype._onPricesResponse = function (accountId, body) {
    clearTimeout(this.pricesTimeout);
    this.pricesTimeout = setTimeout(this._pricesHeartbeatTimeout.bind(this), 10000);
};
OandaAdapter.prototype._onPricesData = function (data) {
    // Single data chunks sometimes contain more than one tick.
    // Each always end with /r/n. Whole chunk therefore not JSON parsable, so must split.
    // A tick may also be split accross data chunks, so must buffer
    data.toString('ascii').split(/\r\n/).forEach(function (line) {
        var update;
        if (line) {
            this._pricesBuffer.push(line);
            try {
                update = JSON.parse(this._pricesBuffer.join(''));
            }
            catch (error) {
                if (this._pricesBuffer.length <= 5) {
                    // Wait for next update.
                    return;
                }
                // Drop if cannot produce object after 5 updates
                this._pricesBuffer = [];
                this.emit('error', {
                    message: 'Unable to parse Oanda price subscription update',
                    code: constants.BROKER_ERROR_PARSE
                });
                return;
            }
            this._pricesBuffer = [];
            if (update.heartbeat) {
                clearTimeout(this.pricesTimeout);
                this.pricesTimeout = setTimeout(this._pricesHeartbeatTimeout.bind(this), 10000);
                return;
            }
            if (update.tick) {
                update.tick.time = new Date(update.tick.time);
                this.emit('price/' + update.tick.instrument, update.tick);
            }
        }
    }, this);
};
OandaAdapter.prototype._pricesHeartbeatTimeout = function () {
    console.warn('[WARN] OandaAdapter: No heartbeat received from prices stream for 10 seconds. Reconnecting.');
    this.emit('stream-timeout');
};
OandaAdapter.prototype._candlesJsonStringToArray = function (chunk) {
};
OandaAdapter.prototype.getCandles = function (symbol, start, end, granularity, count, callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/candles?' + querystring.stringify(JSON.parse(JSON.stringify({
            count: count,
            instrument: symbol,
            start: start || undefined,
            end: end || undefined,
            granularity: granularity,
            alignmentTimezone: 'GMT0',
            dailyAlignment: 0,
            includeFirst: start ? false : undefined
        }))),
        headers: {
            Authorization: 'Bearer ' + this.accessToken,
            'X-Accept-Datetime-Format': 'UNIX',
        }
    }, callback);
};
OandaAdapter.prototype.getTransactionHistory = function (accountId, minId, callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/accounts/' + accountId + '/transactions?' + querystring.stringify(JSON.parse(JSON.stringify({
            minId: minId
        })))
    }, function (err, body) {
        if (err)
            return callback(err);
        if (body && body.transactions) {
            callback(null, body.transactions);
        }
        else {
            callback('Unexpected response for transactions');
        }
    });
};
OandaAdapter.prototype.getOpenPositions = function (accountId, callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/accounts/' + accountId + '/positions'
    }, function (err, body) {
        if (err)
            return callback(err);
        if (body && body.positions) {
            callback(null, body.positions);
        }
        else {
            callback('Unexpected response for open positions');
        }
    });
};
OandaAdapter.prototype.getOpenTrades = function (accountId, callback) {
    this._sendRESTRequest({
        method: 'GET',
        path: '/v1/accounts/' + accountId + '/trades'
    }, function (err, body) {
        if (err)
            return callback(err);
        if (body && body.trades) {
            callback(null, body.trades);
        }
        else {
            callback('Unexpected response for open trades');
        }
    });
};
/**
 * @method createOrder
 * @param {String} accountId Required.
 * @param {Object} order
 * @param {String} order.instrument Required. Instrument to open the order on.
 * @param {Number} order.units Required. The number of units to open order for.
 * @param {String} order.side Required. Direction of the order, either ‘buy’ or ‘sell’.
 * @param {String} order.type Required. The type of the order ‘limit’, ‘stop’, ‘marketIfTouched’ or ‘market’.
 * @param {String} order.expiry Required. If order type is ‘limit’, ‘stop’, or ‘marketIfTouched’. The value specified must be in a valid datetime format.
 * @param {String} order.price Required. If order type is ‘limit’, ‘stop’, or ‘marketIfTouched’. The price where the order is set to trigger at.
 * @param {Number} order.lowerBound Optional. The minimum execution price.
 * @param {Number} order.upperBound Optional. The maximum execution price.
 * @param {Number} order.stopLoss Optional. The stop loss price.
 * @param {Number} order.takeProfit Optional. The take profit price.
 * @param {Number} order.trailingStop Optional The trailing stop distance in pips, up to one decimal place.
 * @param {Function} callback
 */
OandaAdapter.prototype.createOrder = function (accountId, order, callback) {
    this._sendRESTRequest({
        method: 'POST',
        path: '/v1/accounts/' + accountId + '/orders',
        data: order,
        headers: {
            Authorization: 'Bearer ' + this.accessToken,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    }, callback);
};
OandaAdapter.prototype.closeOrder = function (accountId, tradeId, callback) {
    this._sendRESTRequest({
        method: 'DELETE',
        path: '/v1/accounts/' + accountId + '/trades/' + tradeId
    }, function (err, body) {
        if (err)
            return callback(err);
        if (body)
            return callback(null, body);
        callback('Unexpected response for close order');
    });
};
// old
OandaAdapter.prototype._sendRESTRequestStream = function (request, callback, onData) {
    var _this = this;
    request.hostname = this.restHost;
    request.headers = request.headers || {
        Authorization: 'Bearer ' + this.accessToken
    };
    request.secure = this.secure;
    httpClient.sendRequest(request, function (error, body, httpCode) {
        if (!error)
            return callback(null, body);
        var errorObject = {
            originalRequest: request.path,
            code: constants.BROKER_ERROR_UNKNOWN,
            httpCode: httpCode,
            message: ''
        };
        if (httpCode !== 200) {
            if (body && body.disconnect) {
                errorObject.message = body && body.message ? body.message : 'Disconnected';
                errorObject.code = constants.BROKER_ERROR_DISCONNECT;
            }
            else {
                switch (httpCode) {
                    case 401:
                        errorObject.message = body && body.message ? body.message : 'Unauthorized';
                        errorObject.code = constants.BROKER_ERROR_UNAUTHORIZED;
                        break;
                    default:
                        errorObject.message = body && body.message ? body.message : 'Unknown error';
                        errorObject.code = body && body.code ? body.code : constants.BROKER_ERROR_UNKNOWN;
                }
            }
        }
        _this.emit('error', errorObject);
        callback(errorObject);
    }, onData);
};
// new
OandaAdapter.prototype._sendRESTRequest = function (params, callback) {
    var _this = this;
    request({
        uri: 'https://' + this.restHost + params.path,
        headers: params.headers || {
            Authorization: 'Bearer ' + this.accessToken
        },
        method: params.method,
        body: params.data
    })
        .then(function (result) { return callback(null, JSON.parse(result.body)); })
        .catch(function (error) {
        console.log(error);
        var errorObject = {
            originalRequest: params.path,
            code: constants.BROKER_ERROR_UNKNOWN,
            httpCode: error.statusCode,
            message: ''
        };
        if (error.statusCode !== 200) {
            if (error.statusCode && error.body.disconnect) {
                errorObject.message = error.body && error.body.message ? error.body.message : 'Disconnected';
                errorObject.code = constants.BROKER_ERROR_DISCONNECT;
            }
            else {
                switch (error.statusCode) {
                    case 401:
                        errorObject.message = error.body && error.body.message ? error.body.message : 'Unauthorized';
                        errorObject.code = constants.BROKER_ERROR_UNAUTHORIZED;
                        break;
                    default:
                        errorObject.message = error.body && error.body.message ? error.body.message : 'Unknown error';
                        errorObject.code = error.body && error.body.code ? error.body.code : constants.BROKER_ERROR_UNKNOWN;
                }
            }
        }
        _this.emit('error', errorObject);
        callback(errorObject);
    });
};
OandaAdapter.prototype.kill = function () {
    if (this.pricesRequest) {
        this.pricesRequest.abort();
    }
    if (this.eventsRequest) {
        this.eventsRequest.abort();
    }
    this.removeListener();
};
exports.Adapter = OandaAdapter;
