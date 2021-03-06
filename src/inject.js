import { EventEmitter2 as EventEmitter } from "eventemitter2";


//import all the diff loggers
import * as navigatorLogger from './loggers/navigator';
import logger, * as canvasLogger from './loggers/canvas';
import * as webglLogger from './loggers/webgl';
import * as screenLogger from './loggers/screen';
import * as webrtcLogger from './loggers/webrtc';
import * as audioLogger from './loggers/audio';
import * as workerLogger from './loggers/worker';
import * as fontLogger from './loggers/font';
import {guid} from './util'


export const loggers = [
    navigatorLogger,
    canvasLogger,
    webglLogger,
    screenLogger,
    webrtcLogger,
    audioLogger,
    workerLogger,
    fontLogger,
]

//This script gets ran in every JS context BEFORE any other JS
export default function dfpm(self){
    //Check if we have ran before
    if(self.dfpmId) return;

    var dfpmId = guid()
    self.dfpmId = dfpmId

    var logDedupe = {}
    function log(event){
        if(typeof(event) == "object"){
            event.jsContextId = dfpmId;
            event.url = self.location && self.location.toString()
        }
        var msg = JSON.stringify(event)
        if(logDedupe[msg]) return;
        logDedupe[msg] = true;
        dfpm.emitEvent(msg)
    }

    var emitter = new EventEmitter({wildcard:true, newListener:false})
    log(`info injecting...`)
    loggers.forEach((logger)=>{
        logger.logger(self, emitter)
    })
    emitter.on('*', log)

    //--------------------------------------------------
    //It is possible to create an iframe and then never run script in it (so our break point wont fire)
    //Iframes give you a clean JS context so we dirty them up lazyly
    //--------------------------------------------------
    //util function to dfpm iframes created in this manner
    function inject(element) {
        if (element.tagName.toUpperCase() === "IFRAME" && element.contentWindow) {
            try {
                var hasAccess = element.contentWindow.HTMLCanvasElement;
            } catch (e) {
                console.log("can't access " + e);
                return;
            }
            dfpm(element.contentWindow);
        }
    }
    //overrideDocumentProto so you can't get a clean iframe
    function overrideDocumentProto(root) {
        function doOverrideDocumentProto(old, name) {
            //root.prototype[storedObjectPrefix + name] = old;
            Object.defineProperty(root.prototype, name,
                {
                    value: function () {
                        var element = old.apply(this, arguments);
                        if (element == null) {
                            return null;
                        }
                        if (Object.prototype.toString.call(element) === '[object HTMLCollection]' ||
                            Object.prototype.toString.call(element) === '[object NodeList]') {
                            for (var i = 0; i < element.length; ++i) {
                                var el = element[i];
                                inject(el);
                            }
                        } else {
                            inject(element);
                        }
                        return element;
                    }
                }
            );
        }
        doOverrideDocumentProto(root.prototype.createElement, "createElement");
        doOverrideDocumentProto(root.prototype.createElementNS, "createElementNS");
        doOverrideDocumentProto(root.prototype.getElementById, "getElementById");
        doOverrideDocumentProto(root.prototype.getElementsByName, "getElementsByName");
        doOverrideDocumentProto(root.prototype.getElementsByClassName, "getElementsByClassName");
        doOverrideDocumentProto(root.prototype.getElementsByTagName, "getElementsByTagName");
        doOverrideDocumentProto(root.prototype.getElementsByTagNameNS, "getElementsByTagNameNS");
    }
    self.Document && overrideDocumentProto(self.Document);

}
dfpm.emitEvent = console.log