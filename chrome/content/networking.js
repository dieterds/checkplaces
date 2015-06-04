/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the CheckPlaces extension.
 *
 * The Initial Developer of the Original Code is Andy Halford.
 * Portions created by the Initial Developer are Copyright (C) 2009-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var CheckPlacesNetworking = function(uri, method, child, callBack) {
	this.uri = uri;
	this.method = method;
	this.child = child;
	this.callBack = callBack;
	this.channel = null;
	this.startTime = 0;
	this.cancelled = false;
	this.redirected = false;
};

CheckPlacesNetworking.prototype = {
	Cc: Components.classes,
	Ci: Components.interfaces,
	Cr: Components.results,

	init: function() {
		var ioService = this.Cc["@mozilla.org/network/io-service;1"].getService(this.Ci.nsIIOService);
		//Replace any smart-keyword placeholders with the letter 'a'
		var dumbURI = this.uri.replace(/%s/g, 'a');
		var url = ioService.newURI(dumbURI, null, null);
		this.channel = ioService.newChannelFromURI(url);
		if (this.uri.match(/^http/)) {
			var httpChannel = this.channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			httpChannel.requestMethod = this.method;
		}
		this.channel.notificationCallbacks = this;
		this.channel.loadFlags |= this.Ci.nsIRequest.LOAD_BYPASS_CACHE |
											 				this.Ci.nsIRequest.INHIBIT_CACHING;
		this.channel.asyncOpen(this, null);
		this.startTime = new Date().getTime();
	},

	cancel: function() {
		this.startTime = 0;
		this.cancelled = true;
		this.channel.cancel(0x804B0002);	//Send NS_BINDING_ABORTED
	},

  //nsIStreamListener - called when request is started
  onStartRequest: function(request, context) { },

	//Data has been returned - may be called many times
  onDataAvailable: function(request, context, stream, sourceOffset, length) {
		this.startTime = 0;

		//You MUST read the data sent!
		var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
												.createInstance(Components.interfaces.nsIScriptableInputStream);
		sis.init(stream);
		sis.read(length);
	},

	//Called when request has finished
  onStopRequest: function(request, context, status) {
		//Bypass new authentication prompt system for urls with inlined userid/password authentication
		if (status == 0x80470002) {
			this.init();
		}
		else {
			this.startTime = 0;
			try {
				var finalUri = this.redirected ? this.channel.URI.spec : this.uri;
				this.callBack(this.cancelled, status, this.channel, this.uri, finalUri, this.child, this.method == "HEAD");
			} catch(e) {
				//Ignore exceptions when cancelling
			}
		}
	},

  //nsIChannelEventSink
  onChannelRedirect: function(oldChannel, newChannel, flags) {
    //if redirecting, store the new channel and the new URI
    if (this.channel.responseStatus && this.channel.responseStatus == 301) this.redirected = true;
    this.channel = newChannel;
  },
  asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback) {
		this.onChannelRedirect(oldChannel, newChannel, flags);
		callback.onRedirectVerifyCallback(0);
  },

	//Status
  onStatus: function(request, context, status, statusArg) { },

  //nsIProgressEventSink - not implementing will cause annoying exceptions
  onProgress: function(request, context, progress, progressMax) { },

  //nsIHttpEventSink - not implementing will cause annoying exceptions
  onRedirect : function(oldChannel, newChannel) { },

  //If required suppress any certificate errors
  notifyCertProblem: function(socketInfo, status, targetSite) {
    return true;
  },

  //If required, suppress any ssl errors
  notifySSLError: function(socketInfo, error, targetSite) {
    return true;
  },

  //nsIInterfaceRequestor
  getInterface: function(iid) {
    try {
      return this.QueryInterface(iid);

    } catch (exception) {
      throw this.Cr.NS_NOINTERFACE;
    }
  },

  //We are faking an XPCOM interface, so we need to implement QI
  //NB Include BadCert so that I can skip any bad certificate prompts
  QueryInterface: function(iid) {
    if (iid.equals(this.Ci.nsISupports) ||
        iid.equals(this.Ci.nsIInterfaceRequestor) ||
        iid.equals(this.Ci.nsIChannelEventSink) ||
        iid.equals(this.Ci.nsIProgressEventSink) ||
        iid.equals(this.Ci.nsIHttpEventSink) ||
        iid.equals(this.Ci.nsIBadCertListener2) ||
        iid.equals(this.Ci.nsIStreamListener))
    {
      return this;
		}
		//Block any other attempts at prompts?
//    else if (!iid.equals(this.Ci.nsILoadContext)) {
//		else if (iid.equals(this.Ci.nsICookieConsent)) {
//		else {
//			alert(iid);
//		}

    throw this.Cr.NS_NOINTERFACE;
  }
}

//iid reference:
//nsILoadContext 314d8a54-1caf-4721-94d7-f6c82d9b82ed
//nsIDocShellTreeItem	09b54ec1-d98a-49a9-bc95-3219e8b55089
//nsIClassInfo 986c11d0-f340-11d4-9075-0010a4e73d9a
//nsISecurityCheckedComponent 0dad9e8c-a12d-4dcb-9a6f-7d09839356e1
//nsISecureBrowserUI 081e31e0-a144-11d3-8c7c-00609792278c
//nsIDOMWindow a6cf906b-15b3-11d2-932e-00805f8add32
//nsIPrompt a63f70c0-148b-11d3-9333-00104ba0fd40
//nsIDocShellTreeItem 09b54ec1-d98a-49a9-bc95-3219e8b55089
//nsIAuthPrompt
//nsIAuthPrompt2
//nsICookieConsent f5a34f50-1f39-11d6-a627-0010a401eb10
//nsICookieService 011c3190-1434-11d6-a618-0010a401eb10
