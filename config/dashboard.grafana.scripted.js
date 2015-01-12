/* global _ */

/*
 * Complex scripted dashboard
 * This script generates a dashboard object that Grafana can load. It also takes a number of user
 * supplied URL parameters (int ARGS variable)
 *
 * Return a dashboard object, or a function
 *
 * For async scripts, return a function, this function must take a single callback function as argument,
 * call this callback function with the dashboard object (look at scripted_async.js for an example)
 */



// accessable variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn, services, _;

// Setup some variables
var dashboard;

// All url parameters are available via the ARGS object
var ARGS;

// Intialize a skeleton with nothing but a rows array and service object

// default datasource
var datasource = services.datasourceSrv.default;
// get datasource used for saving dashboards
var dashboardDB = services.datasourceSrv.getGrafanaDB();

var targets = [];

var series = [];


function getSeries(){
  return datasource.metricFindQuery('list series').then(function(result) {
    if (!result) {
      return null;
    }
    
    var promises = _.map(result, function(metric) {
      if(metric.text.indexOf('summary')==-1){
        series.push(metric.text);  
      }
      
    });
    
    return services.$q.all(promises);
  });
}

function getTargets(path) {
  return datasource.metricFindQuery(path + '.*').then(function(result) {
    if (!result) {
      return null;
    }

    if (targets.length === 10) {
      return null;
    }

    var promises = _.map(result, function(metric) {
      if (metric.expandable) {
        return getTargets(path + "." + metric.text);
      }
      else {
        targets.push(path + '.' + metric.text);
      }
      return null;
    });

    return services.$q.all(promises);
  });
}

function saveDashboard(dashboard) {
  var model = services.dashboardSrv.create(dashboard);
  dashboardDB.saveDashboard(model);
}

function dynamicSeriesDashboard(callback){
  getSeries().then(function(){
    console.log(series);
    _.each(series, function(s, index) {


      callback(new CREATE_SERIES_ROWS(s));

      
      
    });
  });
}




//DASH Board 기본설정
dashboard = {"id": null,
              "title": "XPUSH Dashboard",
              "originalTitle": "XPUSH Dashboard",
              "tags": [],
              "style": "light",
              "timezone": "browser",
              "editable": true,
              "hideControls": false,
              "sharedCrosshair": false,
              "nav": [{
                        "type": "timepicker",
                        "enable": true,
                        "status": "Stable",
                        "time_options": [
                          "5m",
                          "15m",
                          "1h",
                          "6h",
                          "12h",
                          "24h",
                          "2d",
                          "7d",
                          "30d"
                        ],
                        "refresh_intervals": [
                          "5s",
                          "10s",
                          "30s",
                          "1m",
                          "5m",
                          "15m",
                          "30m",
                          "1h",
                          "2h",
                          "1d"
                        ],
                        "now": true,
                        "collapse": false,
                        "notice": false
                      }
                    ],
              "time": {
                "from": "now-5m",
                "to": "now"
              },
              "templating": {
                "list": []
              },
              "annotations": {
                "list": []
              },
              "refresh": "5s",
              "version": 6,
              "hideAllLegends": false,
              rows : []
            }

var QUERYS ={
               //First Row HEAP MEMORY USED
               memory_used   : "select server, mean(memory_used) from /xpush.channel.*/ where $timeFilter group by time($interval), server order asc"
               //First Row HEAP MEMORY TOTAL 
              ,memory_total  :"select mean(memory_total) from /xpush.channel.*/ where $timeFilter group by time($interval) order asc"
              //Second Row First Column CHANNEL COUNT
              ,channel       :"select channel from \"xpush.summary\" where $timeFilter group by time($interval) order asc"
              //Second Row Second Column CLIENT CHANNEL
              ,client_channel:"select mean(client_channel) from /xpush.channel.*/ where $timeFilter group by time($interval) order asc"
              //Second Row Second Column CLIENT MULTI CHANNEL
              ,client_bigchannel:"select mean(client_bigchannel) from /xpush.channel.*/ where $timeFilter group by time($interval) order asc"
              //Third Row First Column SOCKET COUNT
              ,socket        :"select socket from \"xpush.summary\" where $timeFilter group by time($interval) order asc"
              //Third Row Second Column CLIENT SOCKET
              ,client_socket :"select mean(client_socket) from /xpush.channel.*/ where $timeFilter group by time($interval) order asc"
            }

var HEAP_MEMORY = {
                    "title": "Row1",
                    "height": "300px",
                    "editable": true,
                    "collapse": false,
                    "panels": [
                      {
                        "title": "Heap Memory",
                        "error": false,
                        "span": 12,
                        "editable": true,
                        "type": "graph",
                        "id": 1,
                        "datasource": null,
                        "renderer": "flot",
                        "x-axis": true,
                        "y-axis": true,
                        "y_formats": [
                          "short",
                          "bytes"
                        ],
                        "grid": {
                          "leftMax": null,
                          "rightMax": null,
                          "leftMin": null,
                          "rightMin": null,
                          "threshold1": null,
                          "threshold2": null,
                          "threshold1Color": "rgba(216, 200, 27, 0.27)",
                          "threshold2Color": "rgba(234, 112, 112, 0.22)",
                          "thresholdLine": false
                        },
                        "lines": true,
                        "fill": 0,
                        "linewidth": 1,
                        "points": false,
                        "pointradius": 5,
                        "bars": false,
                        "stack": false,
                        "percentage": false,
                        "legend": {
                          "show": true,
                          "values": false,
                          "min": false,
                          "max": false,
                          "current": false,
                          "total": false,
                          "avg": false,
                          "alignAsTable": false,
                          "hideEmpty": false,
                          "rightSide": false
                        },
                        "nullPointMode": "connected",
                        "steppedLine": false,
                        "tooltip": {
                          "value_type": "cumulative",
                          "shared": false
                        },
                        "targets": [
                          {
                            "function": "mean",
                            "column": "memory_used",
                            "series": "/xpush.channel.*/",
                            "query": QUERYS["memory_used"],
                            "alias": "CH $2 used",
                            "interval": "",
                            "groupby_field": "server",
                            "rawQuery": false,
                            "fill": ""
                          },
                          {
                            "target": "",
                            "function": "mean",
                            "column": "memory_total",
                            "series": "/xpush.channel.*/",
                            "query": QUERYS["memory_total"],
                            "alias": "CH $2 total",
                            "rawQuery": false,
                            "hide": false
                          }
                        ],
                        "aliasColors": {},
                        "seriesOverrides": [],
                        "links": [
                          {
                            "type": "dashboard",
                            "name": "Drilldown dashboard"
                          }
                        ]
                      }
                    ]
                  };

var TOTAL_CHANNEL = {
                      "title": "New row",
                      "height": "200px",
                      "editable": true,
                      "collapse": false,
                      "panels": [
                        {
                          "title": "Total Channel",
                          "error": false,
                          "span": 2,
                          "editable": true,
                          "type": "singlestat",
                          "id": 4,
                          "links": [],
                          "maxDataPoints": 100,
                          "interval": null,
                          "targets": [
                            {
                              "function": "distinct",
                              "column": "channel",
                              "series": "xpush.summary",
                              "query": QUERYS["channel"],
                              "rawQuery": true
                            }
                          ],
                          "cacheTimeout": null,
                          "format": "none",
                          "prefix": "",
                          "postfix": "",
                          "nullText": null,
                          "valueMaps": [
                            {
                              "value": "null",
                              "op": "=",
                              "text": "N/A"
                            }
                          ],
                          "nullPointMode": "null as zero",
                          "valueName": "current",
                          "prefixFontSize": "50%",
                          "valueFontSize": "80%",
                          "postfixFontSize": "50%",
                          "thresholds": "",
                          "colorBackground": true,
                          "colorValue": false,

                          "colors": [
                            "rgba(255, 185, 68, 0.91)",
                            "rgba(245, 150, 40, 0.73)",
                            "rgba(232, 60, 14, 0.4)"
                          ],
                          "sparkline": {
                            "show": false,
                            "full": false,
                            "lineColor": "rgb(31, 120, 193)",
                            "fillColor": "rgba(31, 118, 189, 0.18)"
                          }
                        },
                        {
                          "title": "Channels",
                          "error": false,
                          "span": 10,
                          "editable": true,
                          "type": "graph",
                          "id": 2,
                          "datasource": null,
                          "renderer": "flot",
                          "x-axis": true,
                          "y-axis": true,
                          "y_formats": [
                            "short",
                            "short"
                          ],
                          "grid": {
                            "leftMax": null,
                            "rightMax": null,
                            "leftMin": null,
                            "rightMin": null,
                            "threshold1": null,
                            "threshold2": null,
                            "threshold1Color": "rgba(216, 200, 27, 0.27)",
                            "threshold2Color": "rgba(234, 112, 112, 0.22)"
                          },
                          "lines": true,
                          "fill": 0,
                          "linewidth": 1,
                          "points": false,
                          "pointradius": 5,
                          "bars": false,
                          "stack": false,
                          "percentage": false,
                          "legend": {
                            "show": true,
                            "values": false,
                            "min": false,
                            "max": false,
                            "current": false,
                            "total": false,
                            "avg": false
                          },
                          "nullPointMode": "connected",
                          "steppedLine": false,
                          "tooltip": {
                            "value_type": "cumulative",
                            "shared": false
                          },
                          "targets": [
                            {
                              "function": "mean",
                              "column": "client_channel",
                              "series": "/xpush.channel.*/",
                              "query": QUERYS["client_channel"],
                              "alias": "CH $2 channel"
                            },
                            {
                              "target": "",
                              "function": "mean",
                              "column": "client_bigchannel",
                              "series": "/xpush.channel.*/",
                              "query": QUERYS["client_bigchannel"],
                              "alias": "CH $2 multi channel"
                            }
                          ],
                          "aliasColors": {},
                          "seriesOverrides": [],
                          "links": []
                        }
                      ]
                    };

var TOTAL_SOCKET = {
                    "title": "New row",
                    "height": "200px",
                    "editable": true,
                    "collapse": false,
                    "panels": [
                      {
                        "title": "Total Socket",
                        "error": false,
                        "span": 2,
                        "editable": true,
                        "type": "singlestat",
                        "id": 5,
                        "links": [],
                        "maxDataPoints": 100,
                        "interval": null,
                        "targets": [
                          {
                            "function": "mean",
                            "column": "value",
                            "rawQuery": true,
                            "query": QUERYS["socket"]
                          }
                        ],
                        "cacheTimeout": null,
                        "format": "none",
                        "prefix": "",
                        "postfix": "",
                        "nullText": null,
                        "valueMaps": [
                          {
                            "value": "null",
                            "op": "=",
                            "text": "N/A"
                          }
                        ],
                        "nullPointMode": "null as zero",
                        "valueName": "current",
                        "prefixFontSize": "50%",
                        "valueFontSize": "80%",
                        "postfixFontSize": "50%",
                        "thresholds": "",
                        "colorBackground": true,
                        "colorValue": false,
                        "colors": [
                          "rgba(38, 220, 22, 0.79)",
                          "rgba(161, 143, 122, 0.73)",
                          "rgba(243, 230, 230, 0.59)"
                        ],
                        "sparkline": {
                          "show": false,
                          "full": false,
                          "lineColor": "rgb(31, 120, 193)",
                          "fillColor": "rgba(31, 118, 189, 0.18)"
                        }
                      },
                      {
                        "title": "Sockets",
                        "error": false,
                        "span": 10,
                        "editable": true,
                        "type": "graph",
                        "id": 3,
                        "datasource": null,
                        "renderer": "flot",
                        "x-axis": true,
                        "y-axis": true,
                        "y_formats": [
                          "short",
                          "short"
                        ],
                        "grid": {
                          "leftMax": null,
                          "rightMax": null,
                          "leftMin": null,
                          "rightMin": null,
                          "threshold1": null,
                          "threshold2": null,
                          "threshold1Color": "rgba(216, 200, 27, 0.27)",
                          "threshold2Color": "rgba(234, 112, 112, 0.22)"
                        },
                        "lines": true,
                        "fill": 0,
                        "linewidth": 1,
                        "points": false,
                        "pointradius": 5,
                        "bars": false,
                        "stack": false,
                        "percentage": false,
                        "legend": {
                          "show": true,
                          "values": false,
                          "min": false,
                          "max": false,
                          "current": false,
                          "total": false,
                          "avg": false
                        },
                        "nullPointMode": "connected",
                        "steppedLine": false,
                        "tooltip": {
                          "value_type": "cumulative",
                          "shared": false
                        },
                        "targets": [
                          {
                            "function": "mean",
                            "column": "client_socket",
                            "series": "/xpush.channel.*/",
                            "query": QUERYS["client_socket"],
                            "alias": "CH $2"
                          }
                        ],
                        "aliasColors": {},
                        "seriesOverrides": [],
                        "links": []
                      }
                    ]
                  };


var CREATE_SERIES_ROWS = function(server){
  var obj = {
                    "title": "New row",
                    "height": "100px",
                    "editable": true,
                    "collapse": false,
                    "panels": [{"title": "Server",
                                "error": false,
                                "span": 3,
                                "editable": true,
                                "type": "text",
                                "id": 6,
                                "mode": "html",
                                "content": "<div style=\"height: 60px;line-height: 60px;text-align: center;\"><span style=\"vertical-align: middle;font-weight: 600;font-size: large;\">"+server+"</span></div>",
                                "style": {
                                  "font-size": "60pt"
                                },
                                "links": []
                              },{
                                "title": "Sockets",
                                "error": false,
                                "span": 3,
                                "editable": true,
                                "type": "singlestat",
                                "id": 7,
                                "links": [],
                                "maxDataPoints": 100,
                                "interval": null,
                                "targets": [
                                  {
                                    "function": "first",
                                    "column": "client_socket",
                                    "series": server,
                                    "query": "select first(client_socket) from "+server+" where $timeFilter group by time($interval) order asc"
                                  }
                                ],
                                "cacheTimeout": null,
                                "format": "none",
                                "prefix": "",
                                "postfix": " ea",
                                "nullText": null,
                                "valueMaps": [
                                  {
                                    "value": "null",
                                    "op": "=",
                                    "text": "N/A"
                                  }
                                ],
                                "nullPointMode": "connected",
                                "valueName": "current",
                                "prefixFontSize": "50%",
                                "valueFontSize": "80%",
                                "postfixFontSize": "50%",
                                "thresholds": "30,50,100",
                                "colorBackground": false,
                                "colorValue": true,
                                "colors": [
                                  "rgba(50, 172, 45, 0.97)",
                                  "rgba(237, 129, 40, 0.89)",
                                  "rgba(245, 54, 54, 0.9)"
                                ],
                                "sparkline": {
                                  "show": true,
                                  "full": true,
                                  "lineColor": "rgb(31, 120, 193)",
                                  "fillColor": "rgba(31, 118, 189, 0.18)"
                                }
                                
                              },{
                                "title": "Uptime",
                                "error": false,
                                "span": 4,
                                "editable": true,
                                "type": "singlestat",
                                "id": 8,
                                "links": [],
                                "maxDataPoints": 100,
                                "interval": null,
                                "targets": [
                                  {
                                    "function": "last",
                                    "column": "uptime",
                                    "series": server,
                                    "query": "select first(uptime) from "+server+" where $timeFilter group by time($interval) order asc"
                                  }
                                ],
                                "cacheTimeout": null,
                                "format": "none",
                                "prefix": "",
                                "postfix": " sec ",
                                "nullText": null,
                                "valueMaps": [
                                  {
                                    "value": "null",
                                    "op": "=",
                                    "text": "N/A"
                                  }
                                ],
                                "nullPointMode": "connected",
                                "valueName": "current",
                                "prefixFontSize": "50%",
                                "valueFontSize": "80%",
                                "postfixFontSize": "50%",
                                "thresholds": "6000,60000,600000",
                                "colorBackground": false,
                                "colorValue": true,
                                "colors": [
                                  "rgba(245, 54, 54, 0.9)",
                                  "rgba(237, 129, 40, 0.89)",
                                  "rgba(50, 172, 45, 0.97)"
                                ],
                                "sparkline": {
                                  "show": false,
                                  "full": false,
                                  "lineColor": "rgb(31, 120, 193)",
                                  "fillColor": "rgba(31, 118, 189, 0.18)"
                                }
                              },{
                                "title": "Memory Usage",
                                "error": false,
                                "span": 2,
                                "editable": true,
                                "type": "singlestat",
                                "id": 9,
                                "links": [],
                                "maxDataPoints": 100,
                                "interval": null,
                                "targets": [
                                  {
                                    "function": "mean",
                                    "column": "memory_rss",
                                    "series": server,
                                    "query": "select first(memory_usage) from "+server+" where $timeFilter group by time($interval) order asc",
                                    "rawQuery": true
                                  }
                                ],
                                "cacheTimeout": null,
                                "format": "none",
                                "prefix": "",
                                "postfix": " %",
                                "nullText": null,
                                "valueMaps": [
                                  {
                                    "value": "null",
                                    "op": "=",
                                    "text": "N/A"
                                  }
                                ],
                                "nullPointMode": "connected",
                                "valueName": "current",
                                "prefixFontSize": "50%",
                                "valueFontSize": "80%",
                                "postfixFontSize": "50%",
                                "thresholds": "0,50,80",
                                "colorBackground": true,
                                "colorValue": false,
                                "colors": [
                                  "rgba(50, 172, 45, 0.97)",
                                  "rgba(237, 129, 40, 0.89)",
                                  "rgba(245, 54, 54, 0.9)"
                                ],
                                "sparkline": {
                                  "show": true,
                                  "full": true,
                                  "lineColor": "rgb(31, 120, 193)",
                                  "fillColor": "rgba(31, 118, 189, 0.18)"
                                }
                                
                              }]
                  };
  return obj;
}

var XPUSH_DASHBOARD_LIST = [HEAP_MEMORY,TOTAL_CHANNEL,TOTAL_SOCKET];


for (var i = 0; i < XPUSH_DASHBOARD_LIST.length; i++) {
  
  dashboard.rows.push(XPUSH_DASHBOARD_LIST[i]);
}

dynamicSeriesDashboard(function(dash){
  dashboard.rows.push(dash);
});

return dashboard;

