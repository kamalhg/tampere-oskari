/**
 * @class Oskari.mapframework.bundle.rpc.RemoteProcedureCallInstance
 *
 * Main component and starting point for the RPC functionality.
 *
 * See Oskari.mapframework.bundle.rpc.RemoteProcedureCall for bundle definition.
 *
 */
Oskari.clazz.define(
    'Oskari.mapframework.bundle.rpc.RemoteProcedureCallInstance',
    function () {
        this._channel = null;
        this._localization = {};
        this.eventHandlers = {};
        this.requestHandlers = {};
    },
    {
        /**
         * @public @method getName
         *
         *
         * @return {string} the name for the component
         */
        getName: function () {
            return 'RPC';
        },

        /**
         * @public @method start
         * BundleInstance protocol method
         */
        start: function () {
            'use strict';
            var me = this,
                channel,
                conf = this.conf || {},
                domain = me.conf.domain,
                sandboxName = conf.sandbox ? conf.sandbox : 'sandbox',
                sandbox = Oskari.getSandbox(sandboxName);

            // check configured requests/events
            this.__init(conf);

            me.sandbox = sandbox;
            sandbox.register(this);

            if (!Channel) {
                me.sandbox.printWarn('RemoteProcedureCallInstance.startPlugin(): JSChannel not found.');
                return;
            }

            if (domain === null || domain === undefined || !domain.length) {
                me.sandbox.printWarn('RemoteProcedureCallInstance.startPlugin(): missing domain.');
                return;
            }

            if (domain === '*') {
                me.sandbox.printWarn('RemoteProcedureCallInstance.startPlugin(): * is not an allowed domain.');
                return;
            }

            if (window === window.parent) {
                me.sandbox.printWarn('RemoteProcedureCallInstance.startPlugin(): Target window is same as present window - not allowed.');
                return;
            }

            // Domain is set to * as we want to allow subdomains and such...
            channel = Channel.build({
                window: window.parent,
                origin: '*',
                scope: 'Oskari'
            });

            // Makes it possible to listen to events
            // channel.call({method: 'handleEvent', params: ['MapClickedEvent', true]});
            channel.bind(
                'handleEvent',
                function (trans, params) {
                    if (!me._domainMatch(trans.origin)) {
                        throw {
                            error: 'invalid_origin',
                            message: 'Invalid origin: ' + trans.origin
                        };
                    }
                    if (me._allowedEvents[params[0]]) {
                        if (params[1]) {
                            me._registerEventHandler(params[0]);
                        } else {
                            me._unregisterEventHandler(params[0]);
                        }
                    } else {
                        throw {
                            error: 'event_not_allowed',
                            message: 'Event not allowed: ' + params[0]
                        };
                    }
                }
            );

            // Makes it possible to post requests
            // channel.call({method: 'postRequest', params: ['MapMoveRequest', [centerX, centerY, zoom, marker, srsName]]})
            channel.bind(
                'postRequest',
                function (trans, params) {
                    if (!me._domainMatch(trans.origin)) {
                        throw {
                            error: 'invalid_origin',
                            message: 'Invalid origin: ' + trans.origin
                        };
                    }
                    if (me._allowedRequests[params[0]]) {
                        var builder = me.sandbox.getRequestBuilder(params[0]),
                            request;
                        if (builder) {
                            request = builder.apply(me, params[1]);
                            me.sandbox.request(me, request);
                        } else {
                            throw {
                                error: 'builder_not_found',
                                message: 'No builder found for: ' + params[0]
                            };
                        }
                    } else {
                        throw {
                            error: 'request_not_allowed',
                            message: 'Request not allowed: ' + params[0]
                        };
                    }
                }
            );

            me._bindFunctions(channel);
            me._channel = channel;
        },
        /**
         * Initialize allowed requests/events/functions based on config
         * @param  {Object} conf bundle configuration
         */
        __init : function(conf) {
            var me = this;
            // sanitize conf to prevent unnecessary errors
            conf = conf || {};
            var allowedEvents = conf.allowedEvents;
            var allowedFunctions = conf.allowedfunctions;
            var allowedRequests = conf.allowedRequests;

            if (allowedEvents === null || allowedEvents === undefined) {
                allowedEvents = ['AfterMapMoveEvent', 'MapClickedEvent', 'AfterAddMarkerEvent', 'MarkerClickEvent', 'RouteSuccessEvent', 'UserLocationEvent', 'DrawingEvent'];
            }

            if (allowedFunctions === null || allowedFunctions === undefined) {
                allowedFunctions = ['getAllLayers', 'getAllLayers', 'getMapPosition', 'getSupportedEvents', 'getSupportedFunctions', 'getSupportedRequests',
                    'getZoomRange', 'getMapBbox', 'resetState'];
            }

            if (allowedRequests === null || allowedRequests === undefined) {
                allowedRequests = ['InfoBox.ShowInfoBoxRequest',
                    'MapModulePlugin.AddMarkerRequest',
                    'MapModulePlugin.AddFeaturesToMapRequest',
                    'MapModulePlugin.RemoveFeaturesFromMapRequest',
                    'MapModulePlugin.GetFeatureInfoRequest',
                    'MapModulePlugin.MapLayerVisibilityRequest',
                    'MapModulePlugin.RemoveMarkersRequest',
                    'MapMoveRequest',
                    'ShowProgressSpinnerRequest',
                    'GetRouteRequest',
                    'ChangeMapLayerOpacityRequest',
                    'MyLocationPlugin.GetUserLocationRequest', 
                    'DrawTools.StartDrawingRequest',
                    'DrawTools.StopDrawingRequest'];
            }
            // TODO: try to get event/request builder for each of these to see that they really are supported!!
            me._allowedEvents = this.__arrayToObject(allowedEvents);
            me._allowedFunctions = this.__arrayToObject(allowedFunctions);
            me._allowedRequests = this.__arrayToObject(allowedRequests);
        },
        /**
         * Maps a given array to a dictionary format for easier access
         * @private
         * @param  {String[]} list will be used as keys in the result object. Values are boolean 'true' for each
         * @return {Object}   object with list items as keys and bln true as values
         */
        __arrayToObject: function(list) {
            var result = {};
            for(var i=0; i < list.length; ++i) {
                result[list[i]] = true;
            }
            return result;
        },
        _availableFunctions : {
            // format "supportedXYZ" to an object for easier checking for specific name
            getSupportedEvents : function() {
                return this._allowedEvents;
            },
            getSupportedFunctions : function() {
                var result = {};
                for(var i=0; i < this._allowedFunctions; ++i) {
                    result[this._allowedFunctions] = true;
                }
                return result;
            },
            getSupportedRequests : function() {
                var result = {};
                for(var i=0; i < this._allowedRequests; ++i) {
                    result[this._allowedRequests] = true;
                }
                return result;
            },
            getAllLayers : function() {
                var mapLayerService = this.sandbox.getService('Oskari.mapframework.service.MapLayerService');
                var layers = mapLayerService.getAllLayers();
                return layers.map(function (layer) {
                    return {
                        id: layer.getId(),
                        opacity: layer.getOpacity(),
                        visible: layer.isVisible(),
                        name : layer.getName()
                    };
                });
            },
            getMapBbox : function() {
                var bbox = this.sandbox.getMap().getBbox();
                return {
                    bottom: bbox.bottom,
                    left: bbox.left,
                    right: bbox.right,
                    top: bbox.top
                };
            },
            getMapPosition : function() {
                var sbMap = this.sandbox.getMap();
                return {
                    centerX: sbMap.getX(),
                    centerY: sbMap.getY(),
                    zoom: sbMap.getZoom(),
                    scale: sbMap.getScale(),
                    srsName: sbMap.getSrsName()
                };
            },
            getZoomRange : function() {
                var mapModule = this.sandbox.findRegisteredModuleInstance('MainMapModule');
                return {
                    min: 0,
                    max: mapModule.getMaxZoomLevel(),
                    current: mapModule.getZoom()
                };
            },
            resetState : function() {
                this.sandbox.resetState();
            }
        },

        /**
         * @private @method _bindFunctions
         * Binds functions to the channel
         *
         * @param  {Object} channel Channel
         *
         *
         */
        _bindFunctions: function (channel) {
            'use strict';
            var me = this,
                funcs = this._allowedFunctions;
            var bindFunction = function(name) {
                channel.bind(name, function (trans) {
                    if (!me._domainMatch(trans.origin)) {
                        throw {
                            error: 'invalid_origin',
                            message: 'Invalid origin: ' + trans.origin
                        };
                    }
                    return me._availableFunctions[name].apply(me);
                });
            }

            for(var name in funcs) {
                if(!funcs.hasOwnProperty(name) || !this._availableFunctions[name]) {
                    continue;
                }
                bindFunction(name);
            }
        },

        /**
         * @private @method _domainMatch
         * Used to check message origin, JSChannel only checks for an exact
         * match where we need subdomain matches as well.
         *
         * @param  {string} origin Origin domain
         *
         * @return {Boolean} Does origin match config domain
         */
        _domainMatch: function (origin) {
            'use strict';
            var sb = this.sandbox;
            if(!origin) {
                sb.printWarn('No origin in RPC message');
                // no origin, always deny
                return false;
            }
            // Allow subdomains and different ports
            var domain = this.conf.domain,
                ret = origin.indexOf(domain) !== -1,
                parts;

            // always allow from localhost
            if(origin.indexOf('http://localhost') === 0) {
                return true;
            }

            if (ret) {
                parts = origin.split(domain);
                if (parts) {
                    ret = /^https?:\/\/([a-zA-Z0-9_-]+[.])*$/.test(parts[0]);
                    if (ret && parts.length > 1) {
                        ret = /^(:\d+)?$/.test(parts[1]);
                    }
                } else {
                    // origin must have a protocol
                    ret = false;
                }
            }
            if(!ret) {
                sb.printWarn('Origin not allowed for RPC: ' + origin);
            }

            return ret;
        },

        /**
         * @private @method _registerEventHandler
         *
         * @param {string} eventName Event name
         *
         */
        _registerEventHandler: function (eventName) {
            'use strict';
            var me = this;
            if (me.eventHandlers[eventName]) {
                // Event handler already in place
                return;
            }
            me.eventHandlers[eventName] = function (event) {
                if (me._channel) {
                    me._channel.notify({
                        method: eventName,
                        params: me._getParams(event)
                    });
                }
            };
            me.sandbox.registerForEventByName(me, eventName);
        },

        /**
         * @public @method stop
         * BundleInstance protocol method
         *
         *
         */
        stop: function () {
            'use strict';
            var me = this,
                sandbox = this.sandbox,
                p;

            for (p in me.eventHandlers) {
                if (me.eventHandlers.hasOwnProperty(p)) {
                    sandbox.unregisterFromEventByName(me, p);
                }
            }
            for (p in me.requestHandlers) {
                if (me.requestHandlers.hasOwnProperty(p)) {
                    sandbox.removeRequestHandler(p, this);
                }
            }
            sandbox.unregister(this);
            this.sandbox = null;
        },

        /**
         * @public @method init
         *
         *
         */
        init: function () {
            'use strict';
            return null;
        },

        /**
         * @public @method onEvent
         *
         * @param {Oskari.mapframework.event.Event} event an Oskari event object
         * Event is handled forwarded to correct #eventHandlers if found or
         * discarded if not.
         *
         */
        onEvent: function (event) {
            'use strict';
            var me = this,
                handler = me.eventHandlers[event.getName()];
            if (!handler) {
                return;
            }

            return handler.apply(this, [event]);
        },

        /**
         * @private @method _getParams
         * Returns event's simple variables as params.
         * This should suffice for simple events.
         *
         * @param  {Object} event Event
         *
         * @return {Object}       Event params
         */
        _getParams: function (event) {
            'use strict';
            var ret = {},
                key,
                allowedTypes = ['string', 'number', 'boolean'];

            if (event.getParams) {
                ret = event.getParams();
            } else {
                for (key in event) {
                    // Skip __name and such
                    if (!event.hasOwnProperty(key) || key.indexOf('__') === 0) {
                        continue;
                    }
                    // check that value is one of allowed types
                    if(this.__isInList(typeof event[key], allowedTypes)) {
                        ret[key] = event[key];
                    }
                }
            }

            return ret;
        },
        /**
         * @private @method __isInList
         * Returns true if first parameter is found in the list given as second parameter.
         *
         * @param  {String} value to check
         * @param  {String[]} list to check against
         *
         * @return {Boolean}  true if value is part of the list
         */
        __isInList : function(value, list) {
            var i = 0,
                len = list.length;
            for(;i < len; ++i) {
                if(value === list[i]) {
                    return true;
                }
            }
            return false;
        },

        /**
         * @public @method update
         * BundleInstance protocol method
         *
         *
         */
        update: function () {
            'use strict';
            return undefined;
        },

        /**
         * @private @method _unregisterEventHandler
         *
         * @param {string} eventName
         *
         */
        _unregisterEventHandler: function (eventName) {
            'use strict';
            delete this.eventHandlers[eventName];
            this.sandbox.unregisterFromEventByName(this, eventName);
        }
    },
    {
        /**
         * @static @property {string[]} protocol
         */
        protocol: [
            'Oskari.bundle.BundleInstance',
            'Oskari.mapframework.module.Module'
        ]
    }
);
