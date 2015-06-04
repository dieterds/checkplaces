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

Components.utils.import("resource://gre/modules/Services.jsm");
//var {Cc: classes, Ci: interfaces, Cu: utils} = Components;

var CheckPlacesProgress = {
	expr: /^https?:\/\/[a-z\.0-9\%\:\-\@]*\//i,
	prefs: Services.prefs.getBranch("extensions.checkplaces."),
//	Components.classes["@mozilla.org/preferences-service;1"]
//									 .getService(Components.interfaces.nsIPrefService)
//									 .getBranch("extensions.checkplaces."),
	defaults: Services.prefs.getDefaultBranch("extensions.checkplaces."),
//	Components.classes["@mozilla.org/preferences-service;1"]
//											.getService(Components.interfaces.nsIPrefService)
//											.getDefaultBranch("extensions.checkplaces."),
	bundle: Services.strings.createBundle("chrome://checkplaces/locale/checkplaces.properties"),
//	Components.classes["@mozilla.org/intl/stringbundle;1"]
//           	.getService(Components.interfaces.nsIStringBundleService)
//           	.createBundle("chrome://checkplaces/locale/checkplaces.properties"),
	showingResultsAlready: false,
	cancelled: false,
	debug: false,
	liveLinks: [],
	bookmarkCount: 0,
	livemarkCount: 0,
	pageCount: 0,
	folderCount: 0,
	excludedCount: 0,
	dnsList: [],
	noFileList: [],
	pageErrorList: [],
	serverErrorList: [],
	failedList: [],
	questionableList: [],
	badList: [],
	duplicatesList: [],
	emptyList: [],
	cancelledList: [],
	excludedList: [],
	bookmarkList: [],
	emptyFolderList: [],
	progressWindow: null,
	waitingToFinish: false,
	timedOut: 0,
	favicons: false,
	reloadFavicons: false,
	useHead: true,
	startTime: 0,
	concurrency: 0,
	dbChecked: false,
	dbCheckFailed: false,
	dbCompacted: false,
	dbCompactFailed: false,

	onDialogLoad: function() {
		setTimeout(this.checkBookmarks, 500);
	},

	onDialogCancel: function() {
		//Set flag to ignore any more link errors
		this.cancelled = true;

		//Kill anything still hanging around
		if (this.liveLinks && this.liveLinks.length) {
			for (var i=0; i<this.liveLinks.length; i++) {
				var cpn = this.liveLinks[i].cpn;
				if (this.pageCount > 0) this.pageCount--;
				//this.addItemToList("cancelled", this.bundle.GetStringFromName('cancelled'), cpn.uri, this.liveLinks[i].id);
				if (cpn.channel && cpn.channel.isPending()) {
					cpn.cancel();
				}
			}
		}
		this.liveLinks = null;
		this.showResults();
	},

	//Called from progress.xul to do the actual checking
	checkBookmarks: function() {
		//Recurse the bookmarks tree checking each one
		function recurseTree(container, checkContents) {
			function asContainer(container) {
				return container.QueryInterface(Components.interfaces.nsINavHistoryContainerResultNode);
			}

			//Ignore links and other non-folders
			if (container.itemId == -1 || PlacesUtils.getConcreteItemId(container) != container.itemId) {
				if (cpp.debug) Components.utils.reportError("Ignoring container: " + container.itemId);
				return false;
			}

			//Ignore the tags folder
			if (container.itemId == PlacesUtils.tagsFolderId) return false;

			//Ignore excluded folders
			for (var i=0; i<excludeFolders.length; i++) {
				if (container.itemId == excludeFolders[i]) return false;
			}

			//Sometimes the container doesn't open
			//In which case skip it
			asContainer(container).containerOpen = true;
			try {
				//Just a dummy test
				if (container.childCount > 0) var tested = true;
			} catch(e) {
				if (checkContents) cpp.addItemToList("failed", cpp.bundle.GetStringFromName('bad_folder'), null, container.itemId);
				try {
					asContainer(container).containerOpen = false;
				} catch(e1) {
				}
				return false;
			}

			if (checkContents && container.itemId != PlacesUtils.placesRootId)
				cpp.folderCount++;

			//Set to false if anything other than separators in the children
			var isEmpty = true;

			for (var i=0; i<container.childCount; i++) {
				var child = container.getChild(i);

				//Skip excluded items
				//But continue on to find out what the uri may be
				var excluded = false;
				try {
					PlacesUtils.annotations.getItemAnnotation(child.itemId, CheckPlacesResults.EXCLUDE_ANNO);
					cpp.excludedCount++;
					excluded = true;
					isEmpty = false;
				} catch (e) {
				}

				//Ignore queries
				if (PlacesUtils.nodeIsQuery(child)) {
					isEmpty = false;
					if (!excluded && child.uri) notDuplicate(child.uri, child);
				}
				else if (checkContents && PlacesUtils.nodeIsBookmark(child)) {
					isEmpty = false;

					//Skip excluded items
					if (excluded) {
						cpp.addItemToList("excluded", excludedString, child.uri, child.itemId);
						continue;
					}

					//Check the uri is not corrupted
					cpp.bookmarkCount++;
					try {
						PlacesUtils._uri(child.uri);

						//Check any sort of bookmark for duplicates
						var notADuplicate = notDuplicate(child.uri, child);

						//Ignore anything other than http(s),file and (s)ftp(s)
						if (child.uri.match(/^file:/) || child.uri.match(/^https?:/) ||
								child.uri.match(/^s?ftps?:/))
						{
							if (notADuplicate && checkLinks) cpp.checkLink(cpp.useHead, child, child.uri);
						}
						//Errors if badly formed scheme (mispelt file/http/sftp)
						else if (child.uri.match(/^fi/) || child.uri.match(/^ht/) ||
								child.uri.match(/^s?ft/))
						{
							cpp.addItemToList("bad", bundle.GetStringFromName('bad_uri'), child.uri, child.itemId);
						}

					} catch(e) {
						if (!cpp.cancelled) Components.utils.reportError(e);
						cpp.addItemToList("bad", bundle.GetStringFromName('bad_uri'), child.uri, child.itemId);
					}
				}
				else if (PlacesUtils.nodeIsFolder(child)) {
					//Skip excluded items
					if (excluded) {
						cpp.addItemToList("excluded", excludedString, "", child.itemId);
						continue;
					}

					//Skip special 'no title' admin folder
					if (container.itemId == PlacesUtils.placesRootId && !child.title) {
						try {
							PlacesUtils.annotations.getItemAnnotation(child.itemId, "placesInternal/READ_ONLY");
							continue;
						} catch(e) {
							if (cpp.debug) Components.utils.reportError(e);
						}
					}

					//If in 'include' list then check the containers contents
					var checkContainer = checkContents;
					if (!checkContainer) {
						for (var j=0; j<includeFolders.length; j++) {
							if (child.itemId == includeFolders[j]) {
								checkContainer = true;
								break;
							}
						}
					}
					if (recurseTree(child, checkContainer) == false) isEmpty = false;
				}
			}

			//Treat folders that just have seps in as empty as well as truly empty ones
			if (checkContents && checkEmpty) {
				if ((container.childCount == 0 || isEmpty) &&
						PlacesUtils.bookmarks.getFolderIdForItem(container.itemId) != PlacesUtils.placesRootId)
				{
					cpp.emptyFolderList.push(container.itemId);
				}
			}

			//Close the current container
			asContainer(container).containerOpen = false;

			//Return whether or not the container was empty
			return isEmpty;
		}

		function notDuplicate(uri, child) {
			var bm = cpp.bookmarkList;
			var dupIndex = -1;
			for (var i=0; i<bm.length; i++) {
				if (bm[i].uri == uri) {
					dupIndex = i;
					break;
				}
			}
			if (dupIndex != -1) {
				if (checkDuplicates) {
					var dl = cpp.duplicatesList;
					var foundDuplicate = false;
					var count;
					for (var i=0; i<dl.length; i++) {
						if (dl[i].uri == uri) {
							foundDuplicate = true;
						}
					}

					//First time duplicate found add the original as well
					if (!foundDuplicate) {
						cpp.addItemToList("duplicates", cpp.bundle.GetStringFromName('duplicate'), uri, bm[dupIndex].id);
					}
					cpp.addItemToList("duplicates", cpp.bundle.GetStringFromName('duplicate'), uri, child.itemId);
				}
			}
			else {
				var bookmark = {};
				bookmark.id = child.itemId;
				bookmark.uri = uri;
				bm.push(bookmark);
			}
			return (dupIndex == -1);
		}

		function checkFolderExists(folderID) {
			try {
				var type = PlacesUtils.bookmarks.getItemType(folderID);

			} catch(e) {
				return false;
			}
			return true;
		}

		function checkFolderType(folderID) {
			var type = PlacesUtils.bookmarks.getItemType(folderID);
			return (type == PlacesUtils.bookmarks.TYPE_FOLDER);
		}

		//function Start()
		//{
		//START HERE
		//this.bundle = Services.strings.createBundle("chrome://checkplaces/locale/checkplaces.properties");
//		Components.classes["@mozilla.org/intl/stringbundle;1"]
//										.getService(Components.interfaces.nsIStringBundleService)
//										.createBundle("chrome://checkplaces/locale/checkplaces.properties");
		var cpp = CheckPlacesProgress;
		cpp.startTime = new Date().getTime();
		cpp.cancelled = false;
		cpp.debug = cpp.prefs.getBoolPref("debug");

		//What to check
		var checkLinks = cpp.prefs.getBoolPref("check_links");
		cpp.favicons = checkLinks ? cpp.prefs.getBoolPref("find_icons") : false;
		cpp.reloadFavicons = checkLinks ? cpp.prefs.getBoolPref("reload_icons") : false;
		cpp.useHead = !cpp.prefs.getBoolPref("use_get");
		var checkDuplicates = cpp.prefs.getBoolPref("check_duplicates");
		var checkEmpty = cpp.prefs.getBoolPref("check_empty");
		try {
			var includeFolders = [];	//This means include everything (ie start at PlacesUtils.placesRootId)
			if (cpp.prefs.getBoolPref("include")) {
				includeFolders = cpp.prefs.getCharPref("include_folder_ids").split(",");
				if (!includeFolders.length || !includeFolders[0])
					includeFolders = [];
				else {
					for (var i=0; i<includeFolders.length; i++) {
						if (!checkFolderExists(includeFolders[i])) {
							cpp.myAlert('missing_subfolder');
							cpp.showResults();
							return;
						}
						else if (!checkFolderType(includeFolders[i])) {
							cpp.myAlert('wrong_type_subfolder');
							cpp.showResults();
							return;
						}
					}
				}
			}
			var excludeFolders = [];
			if (cpp.prefs.getBoolPref("exclude")) {
				excludeFolders = cpp.prefs.getCharPref("exclude_folder_ids").split(",");
				if (!excludeFolders.length || !excludeFolders[0]) excludeFolders = [];
			}

			//Check Places database
			if (cpp.prefs.getBoolPref("check_db")) {
				cpp.dbChecked = true;
				cpp.checkDatabase();
			}
			if (cpp.prefs.getBoolPref("compact_db")) {
				cpp.dbCompacted = true;
				cpp.compactDatabase();
			}

			//Run the query - always at the top level so that folders are included and then include/exclude using my own processing
			var options = PlacesUtils.history.getNewQueryOptions();
			var query = PlacesUtils.history.getNewQuery();
			query.setFolders([PlacesUtils.placesRootId], 1);
			var result = PlacesUtils.history.executeQuery(query, options);

			//Recursively check each bookmark
			cpp.bookmarkCount = 0;
			cpp.livemarkCount = 0;
			cpp.folderCount = 0;
			cpp.pageCount = 0;
			cpp.liveLinks = [];
			cpp.badList = [];
			cpp.dnsList = [];
			cpp.pageErrorList = [];
			cpp.serverErrorList = [];
			cpp.noFileList = [];
			cpp.failedList = [];
			cpp.questionableList = [];
			cpp.bookmarkList = [];
			cpp.emptyFolderList = [];
			cpp.duplicatesList = [];
			cpp.emptyList = [];
			cpp.cancelledList = [];
			cpp.excludedList = [];
			cpp.showingResultsAlready = false;
			cpp.waitingToFinish = false;
			cpp.timedOut = 0;
			var excludedString = 'Excluded from check';//cpp.bundle.GetStringFromName('excluded');
			window.setCursor("wait");
			if (checkLinks && cpp.prefs.getBoolPref("use_concurrency"))
				cpp.concurrency = cpp.prefs.getCharPref("concurrency");
			if (checkLinks && cpp.prefs.getBoolPref("use_timeout"))
				CheckPlacesTimer.init(cpp.prefs.getCharPref("timeout"));
			recurseTree(result.root, !includeFolders.length);	//If no includeFolders then include everything

			//Add any empty folders to list
			for (var i=0; i<cpp.emptyFolderList.length; i++) {
				cpp.addItemToList("empty", cpp.bundle.GetStringFromName('empty_folder'), null, cpp.emptyFolderList[i]);
			}


		} catch(e) {
			cpp.myAlert(null, e);
			window.close();
			return;
		}

		//Finish up (or wait)
		cpp.waitingToFinish = true;
		if (!checkLinks || !cpp.liveLinks || !cpp.liveLinks.length)
			cpp.showResults();
		else
			cpp.updateProgress();
	},

	//Display my own style alert when find a problem
	myAlert: function(key, exception) {
		var params = {inn:{key:key, exception:exception}, out:null};
		window.openDialog('chrome://checkplaces/content/alert.xul', '_blank',
											'chrome,modal,centerscreen', params);
	},

	//Check the Places database
	checkDatabase: function() {
		if (CheckPlacesProgress.debug) Components.utils.reportError("Database check started");

		var sql = "Pragma integrity_check(10)";
		var stmt = CheckPlacesProgress.getStatement(sql);

		CheckPlacesProgress.dbCheckFailed = false;
		try {
			while (stmt.step()) {
				if (stmt.row.integrity_check != 'ok') {
					Components.utils.reportError(stmt.row.integrity_check);
					CheckPlacesProgress.dbCheckFailed = true;
				}
			}
		} catch (e) {
			Components.utils.reportError(e);
			CheckPlacesProgress.dbCheckFailed = true;

		} finally {
			stmt.reset();
		}

		if (CheckPlacesProgress.debug) Components.utils.reportError("Database check ended");
		if (CheckPlacesProgress.dbCheckFailed) CheckPlacesProgress.myAlert('places_database_error');
	},

	//Compact the Places database (Synchronously, so may hang firefox)
	compactDatabase: function() {
		CheckPlacesProgress.dbCompactFailed = false;
		if (CheckPlacesProgress.debug) Components.utils.reportError("Database compaction started");
		try {
			var stmt = CheckPlacesProgress.getStatement("VACUUM");
			stmt.execute();
		} catch(e) {
			Components.utils.reportError("Database compaction");
			Components.utils.reportError(e);
			CheckPlacesProgress.dbCompactFailed = true;
		}
		if (CheckPlacesProgress.debug) Components.utils.reportError("Database compaction ended");
	},

	getStatement: function(sql) {
		//Which firefox version
		var version = "3.0";
		try {
			var info = Components.classes["@mozilla.org/xre/app-info;1"]
													 .getService(Components.interfaces.nsIXULAppInfo);
			version = info.version;
		} catch(e) {
		}

		//Firefox 3.0
		var stmt;
		if (version.substring(0,3) == "3.0") {
			var places = Components.classes["@mozilla.org/file/directory_service;1"]
														 .getService(Components.interfaces.nsIProperties)
														 .get("ProfD", Components.interfaces.nsIFile);
			places.append("places.sqlite");
			var statement = Components.classes["@mozilla.org/storage/service;1"]
																.getService(Components.interfaces.mozIStorageService)
																.openDatabase(places)
																.createStatement(sql);
			stmt = Components.classes["@mozilla.org/storage/statement-wrapper;1"]
											 .createInstance(Components.interfaces.mozIStorageStatementWrapper);
			stmt.initialize(statement);
		}
		//Firefox 3.5+
		else {
			stmt = Components.classes["@mozilla.org/browser/nav-history-service;1"]
													 .getService(Components.interfaces.nsPIPlacesDatabase)
													 .DBConnection.createStatement(sql);
		}

		return stmt;
	},

	onAlertLoad: function() {
		var key = window.arguments[0].inn.key;
		var exception = window.arguments[0].inn.exception;
		if (exception) {
			Components.utils.reportError(exception);
			var message = "O/S: ";
			try {
				message = message + Components.classes["@mozilla.org/xre/app-info;1"]
											 .createInstance(Components.interfaces.nsIXULRuntime).OS;
			} catch(e) {
			}
			var version = "";
			try {
				var info = Components.classes["@mozilla.org/xre/app-info;1"]
						       					 .getService(Components.interfaces.nsIXULAppInfo);
				version = "%0A" + info.name + ": " + info.version + " " + info.appBuildID;
			} catch(e) {
			}
			message = message + version + "%0ACheckPlaces: ";
			message = message + this.prefs.getCharPref("version") + "%0A%0A" + exception.toString() + "%0A%0APrefs:";

			//Iterate over the prefs
			try {
				var prefList = this.defaults.getChildList("", {});
				for (var i = 0 ; i < prefList.length ; i++) {
					var id = prefList[i];
					switch (this.defaults.getPrefType(id)) {
						case this.defaults.PREF_BOOL:
							message = message + "%0A" + id + ": " + this.prefs.getBoolPref(id);
						break;

						case this.defaults.PREF_STRING:
							message = message + "%0A" + id + ": " + this.prefs.getCharPref(id);
						break;
					}
				}
			} catch(e) {
			}

			var link = "mailto:andy@andyhalford.com?subject=CheckPlaces%20Exception&body=" + message;
			document.getElementById("link").href=link;
			document.getElementById("text").value = exception.toString();
		}
		else {
			var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
	           					.getService(Components.interfaces.nsIStringBundleService)
           						.createBundle("chrome://checkplaces/locale/checkplaces.properties");
			document.getElementById("message").value = bundle.GetStringFromName(key);
			document.getElementById("link").hidden = true;
			document.getElementById("text").hidden = true;
		}
		document.documentElement.getButton("accept").focus();
	},

	updateProgress: function() {
		window.setCursor("auto");
		var cpp = CheckPlacesProgress;
		var total = cpp.bookmarkCount + cpp.livemarkCount;
		document.getElementById("meter").mode="determined";
		document.getElementById("progress").value = (total - cpp.liveLinks.length) + "/" + total;
		document.getElementById("meter").value = (100 * (total - cpp.liveLinks.length))/total;
	},

	checkLink: function(head, child, uri) {
		if (this.cancelled) return;
		this.pageCount++;
		try {
			var method = head ? "HEAD" : "GET";
			var cpn = new CheckPlacesNetworking(uri, method, child, this.callBack);
			method = (uri.match(/^http/) ? " with " + method : "") + ": ";

			//If limiting concurrency then only start up to the limit - the rest can wait
			if (this.concurrency && this.liveLinks && this.liveLinks.length) {
				if (this.liveLinks.length < this.concurrency) {
					if (this.debug) Components.utils.reportError("Checking link" + method + uri);
					cpn.init();
				}
			}
			else {
				if (this.debug) Components.utils.reportError("Checking link" + method + uri);
				cpn.init();
			}
			var link = {};
			link.cpn = cpn;
			link.id = child.itemId;
			this.liveLinks.push(link);
			this.updateProgress();

		//If cpn.init() fails ...
		} catch(e) {
			if (this.debug) Components.utils.reportError("Checked link: " + uri);
			if (uri.match(/^file:/))
				this.addItemToList("noFile", this.bundle.GetStringFromName('file_not_found'), uri, child.itemId);
			else {
				if (!this.cancelled) Components.utils.reportError(e);
				this.addItemToList("failed", this.bundle.GetStringFromName('send_failure'), uri, child.itemId);
			}
		}
	},

	addItemToList: function(list, status, uri, itemId) {
		//Ignore errors after the cancel button pressed as these may be caused by the cancellation process
		if (this.cancelled && list != "cancelled") return;

		var failedItem = this.getItemDetails(status, uri, itemId, this.debug);

		if (list == "bad")
			this.badList.push(failedItem);
		else if (list == "dns")
			this.dnsList.push(failedItem);
		else if (list == "pageError")
			this.pageErrorList.push(failedItem);
		else if (list == "serverError")
			this.serverErrorList.push(failedItem);
		else if (list == "noFile")
			this.noFileList.push(failedItem);
		else if (list == "failed")
			this.failedList.push(failedItem);
		else if (list == "questionable")
			this.questionableList.push(failedItem);
		else if (list == "cancelled")
			this.cancelledList.push(failedItem);
		else if (list == "excluded")
			this.excludedList.push(failedItem);
		else if (list == "duplicates") {
			var dl = this.duplicatesList;
			var foundDuplicate = false;
			for (var i=0; i<dl.length; i++) {
				if (dl[i].uri == uri) {
					foundDuplicate = true;
					dl[i].dups.push(failedItem);
					break;
				}
			}
			if (!foundDuplicate) {
				var duplicate = {};
				duplicate.uri = uri;
				duplicate.dups = [];
				duplicate.dups.push(failedItem);
				dl.push(duplicate);
			}
		}
		else
			this.emptyList.push(failedItem);
	},

	getItemDetails: function(status, uri, itemId, debug) {
		var failedItem = {};
		failedItem.id = itemId;
		failedItem.status = status;
		failedItem.uri = uri;

		//name
		try {
			failedItem.name = PlacesUtils.bookmarks.getItemTitle(itemId);
		} catch(e) {
			failedItem.name = "ILLEGAL VALUE IN NAME";
		}

		//path
		var id = itemId;
		try {
			do {
				id = PlacesUtils.bookmarks.getFolderIdForItem(id);
				var title = "";
				try {
					title = PlacesUtils.bookmarks.getItemTitle(id);
				} catch(e) {
				}
				if (title) failedItem.path = title + (failedItem.path ? " > " + failedItem.path : "");
			} while (id != PlacesUtils.placesRootId);
		} catch(e) {
			if (debug) {
				Components.utils.reportError("Calculating path");
				Components.utils.reportError(e);
			}
		}

		//date added
		try {
			failedItem.dateAdded = PlacesUtils.bookmarks.getItemDateAdded(itemId);
		} catch(e) {
			failedItem.dateAdded = new Date(0);	//The oldest date possible for dups comparison
		}

		//date modified
		try {
			failedItem.lastModified = PlacesUtils.bookmarks.getItemLastModified(itemId);
			failedItem.lastModified = new Date(failedItem.lastModified/1000).toLocaleString();
		} catch(e) {
		}

		//tags
		failedItem.tags = "";
		try {
			failedItem.tags = PlacesUtils.tagging.getTagsForURI(
													Components.classes["@mozilla.org/network/io-service;1"]
           													.getService(Components.interfaces.nsIIOService)
           													.newURI(uri, null, null), {});
		} catch(e) {
		}

		//keyword
		try {
			failedItem.keyword = PlacesUtils.bookmarks.getKeywordForBookmark(itemId);
		} catch(e) {
		}

		//description
		failedItem.description = "";
		try {
			var annos = PlacesUtils.getAnnotationsForItem(itemId);
			if (annos) {
				annos.forEach(function(anno) {
					if (anno.name == "bookmarkProperties/description") {
						failedItem.description = anno.value;
					}
				});
			}
		} catch(e) {
		}

		return failedItem;
	},

	callBack: function(cancelled, status, channel, uri, finalUri, child, head) {
//		var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
//										.getService(Components.interfaces.nsIStringBundleService)
//										.createBundle("chrome://checkplaces/locale/checkplaces.properties");
		var cpp = CheckPlacesProgress;
		if (cpp.debug) {
			Components.utils.reportError("Checked link: " + uri);
			if (finalUri != uri) Components.utils.reportError("Permanent redirect to: " + finalUri);
		}

		//Remove request from the array
		if (cpp.liveLinks && cpp.liveLinks.length) {
			var index = -1;
			for (var i=0; i<cpp.liveLinks.length; i++) {
				if (cpp.liveLinks[i].cpn.uri == uri) {
					index = i;
					break;
				}
			}
			if (index != -1) {
				cpp.liveLinks.splice(index, 1);
				cpp.updateProgress();
			}

			//Start any waiting threads if using concurrency limit
			if (cpp.concurrency) {
				var startedNext = false;
				while (!startedNext && cpp.liveLinks.length) {
					var next = -1;
					for (var i=0; i<cpp.liveLinks.length; i++) {
						if (!cpp.liveLinks[i].cpn.startTime) {
							next = i;
							break;
						}
					}
					if (next == -1) break;

					//This isn't thread safe, but the best I can do with javascript
					var cpn = cpp.liveLinks[next].cpn;
					var id = cpp.liveLinks[next].id;
					if (cpp.debug) {
						var method = head ? "HEAD" : "GET";
						method = (uri.match(/^http/) ? " with " + method : "") + ": ";
						Components.utils.reportError("Checking link" + method + cpn.uri);
					}
					try {
						cpn.init();
						startedNext = true;

					//Deal with missing files
					} catch(e) {
						if (cpp.debug) Components.utils.reportError("Checked link: " + cpn.uri);
						cpp.liveLinks.splice(next, 1);
						cpp.updateProgress();
						startedNext = false;

						if (cpn.uri.match(/^file:/)) {
							cpp.addItemToList("noFile", cpp.bundle.GetStringFromName('file_not_found'), cpn.uri, id);
						}
						else {
							if (!this.cancelled) Components.utils.reportError(e);
							cpp.addItemToList("failed", cpp.bundle.GetStringFromName('send_failure'), cpn.uri, id);
						}
					}
				}
			}
		}

		//Check the response
		if (cancelled) {
			//Do nothing
		}
		else if (!channel) {
			//http
			if (uri.match(/^http/) && head) {
				cpp.pageCount--;
				cpp.checkLink(false, child, uri);		//retry with GET
				return;
			}
			//File/ftp etc
			if (!cpp.cancelled && status) {
				Components.utils.reportError("0x" + status.toString(16));
				Components.utils.reportError(uri);
			}
			cpp.addItemToList("questionable", bundle.GetStringFromName('connection_failure'), uri, child.itemId);
		}
		else if (uri.match(/^http/)) {
			try {
				var httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
				var resCode = httpChannel.responseStatus;
				var statusText = httpChannel.responseStatusText;
				if (resCode == 401 || resCode == 407) {
					cpp.addItemToList("questionable", resCode + " : " + statusText, uri, child.itemId);
				}
				else if (resCode == 400 || resCode == 403 || resCode == 405) {
					if (head) {
						cpp.pageCount--;
						cpp.checkLink(false, child, uri);		//retry with GET
						return;
					}
					else {
						cpp.addItemToList("pageError", resCode + " : " + statusText, uri, child.itemId);
					}
				}
				else if (resCode > 400 && resCode < 500) {
					cpp.addItemToList("pageError", resCode + " : " + statusText, uri, child.itemId);
				}
				else if (resCode >= 500) {
					cpp.addItemToList("serverError", resCode + " : " + statusText, uri, child.itemId);
				}
				//Other codes are passes
				else {
					//Log Permanent redirects as they really should be changed before being lost
					if (finalUri != uri) {
						cpp.addItemToList("questionable", "301 : " + finalUri, uri, child.itemId);
					}

					//do favicon check
					if (cpp.favicons) {
						var faviconURL = null;
						try {
							faviconURL = PlacesUtils.favicons.getFaviconForPage(PlacesUtils._uri(uri));
						} catch(e) {
						}

						//If no existing favicon, or you are doing a forced overwrite of them ...
						if (!faviconURL || faviconURL.spec.match(/^http:\/\/www.mozilla.org\/2005\/made-up-favicon/) || cpp.reloadFavicons) {
							//Attempt to read the favicon (use an expression to lower case the uri for some reason?)
							try {
								if (cpp.debug) Components.utils.reportError("Reloading favicon: " + uri + "favicon.ico");
								PlacesUtils.favicons.setAndLoadFaviconForPage(PlacesUtils._uri(uri), PlacesUtils._uri(cpp.expr.exec(uri) + "favicon.ico"),
																															cpp.reloadFavicons);
							} catch(e) {
								if (cpp.debug) {
									Components.utils.reportError("setAndLoadFaviconForPage(" + uri + "favicon.ico)");
									Components.utils.reportError(e);
								}
							}
						}
					}
				}
			} catch(e) {
				if (!cpp.cancelled) {
					if (head) {
						cpp.pageCount--;
						cpp.checkLink(false, child, uri);		//retry with GET
						return;
					}
					else {
						cpp.decodeStatus(status, uri, child.itemId, e);
					}
				}
			}
		}
		//Ftp unsuccessful status
		else if (uri.match(/^s?ftps?:/) && !Components.isSuccessCode(status)) {
			cpp.decodeStatus(status, uri, child.itemId);
		}
		//others are all passes if get this far

		//Is this the last link to check?
		if (cpp.waitingToFinish && (!cpp.liveLinks || !cpp.liveLinks.length))
			cpp.showResults();
		else
			cpp.updateProgress();
	},

	//Display the results
	showResults: function() {
		function sortByURI(a, b) {
			//Sort by uri
			if (a.uri < b.uri)
				return -1;
			else if (a.uri > b.uri)
				return 1;
			else return 0;
		}
		function sortByPath(a, b) {
			//Sort by path
			if (a.path < b.path)
				return -1;
			else if (a.path > b.path)
				return 1;
			else return 0;
		}

		//To prevent this being called multiple times
		if (this.showingResultsAlready) return;
		this.showingResultsAlready = true;

		//Stop the timer
		if (CheckPlacesProgress.prefs.getBoolPref("check_links") &&
				CheckPlacesProgress.prefs.getBoolPref("use_timeout"))
			CheckPlacesTimer.cancel();
		var elapsed = (new Date().getTime()) - this.startTime;

		//Return the results to options.js
		window.arguments[0].out = {elapsed:elapsed,
															 dnsList:this.dnsList.sort(sortByPath),
															 pageErrorList:this.pageErrorList.sort(sortByPath),
															 serverErrorList:this.serverErrorList.sort(sortByPath),
															 noFileList:this.noFileList.sort(sortByPath),
															 failedList:this.failedList.sort(sortByPath),
															 questionableList:this.questionableList.sort(sortByPath),
															 badList:this.badList.sort(sortByPath),
															 duplicatesList:this.duplicatesList.sort(sortByURI),
															 emptyList:this.emptyList.sort(sortByPath),
															 cancelledList:this.cancelledList.sort(sortByPath),
															 excludedList:this.excludedList.sort(sortByPath),
															 bookmarkCount:this.bookmarkCount,
															 livemarkCount:this.livemarkCount,
															 pageCount:this.pageCount,
															 excludedCount:this.excludedCount,
															 folderCount:this.folderCount,
															 dbChecked:this.dbChecked,
															 dbCheckFailed:this.dbCheckFailed,
															 dbCompacted:this.dbCompacted,
															 dbCompactFailed:this.dbCompactFailed};
		window.close();
	},

	decodeStatus: function(status, uri, id, e) {
		var message = null;
		switch (status) {
			case 0x8000FFFF:
				message = this.bundle.GetStringFromName('response_failure');
				break;
			case 0x804B0001:
				message = this.bundle.GetStringFromName('NS_BINDING_FAILED');
				break;
			case 0x804B0002:
				message = this.bundle.GetStringFromName('NS_BINDING_ABORTED');
				return;		//If cancelled by user/timer then don't report it
				break;
			case 0x804B000A:
				message = this.bundle.GetStringFromName('NS_ERROR_MALFORMED_URI');
				break;
			case 0x804B000D:
				message = this.bundle.GetStringFromName('NS_ERROR_CONNECTION_REFUSED');
				break;
			case 0x804B000E:
				message = this.bundle.GetStringFromName('NS_ERROR_NET_TIMEOUT');
				break;
			case 0x804B0010:
				message = this.bundle.GetStringFromName('NS_ERROR_OFFLINE');
				break;
			case 0x804B0014:
				message = this.bundle.GetStringFromName('NS_ERROR_NET_RESET');
				break;
			case 0x804B0015:
				message = this.bundle.GetStringFromName('NS_ERROR_FTP_LOGIN');
				break;
			case 0x80520012: 	//NS_ERROR_FILE_NOT_FOUND
			case 0x80004005:	//NS_ERROR_FAILURE - general error
			case 0x804B001B:	//NS_ERROR_INVALID_CONTENT_ENCODING
			case 0x804B0016:	//NS_ERROR_FTP_CWD
				message = this.bundle.GetStringFromName('NS_ERROR_FTP_CWD');
				break;
			case 0x804B0017:
				message = this.bundle.GetStringFromName('NS_ERROR_FTP_PASV');
				break;
			case 0x804B0018:
				message = this.bundle.GetStringFromName('NS_ERROR_FTP_PWD');
				break;
			case 0x804B001C:
				message = this.bundle.GetStringFromName('NS_ERROR_FTP_LIST');
				break;
			case 0x804B001E:
				message = this.bundle.GetStringFromName('NS_ERROR_UNKNOWN_HOST');
				break;
			case 0x804B0046:
				message = this.bundle.GetStringFromName('NS_ERROR_DOCUMENT_NOT_CACHED');
				break;
			case 0x804B0047:
				message = this.bundle.GetStringFromName('NS_ERROR_NET_INTERRUPT');
				break;
			case 0x804B0048:
				message = this.bundle.GetStringFromName('NS_ERROR_PROXY_CONNECTION_REFUSED');
				break;
			case 0x805A1FF3:
			case 0x805A1FDC:
			case 0x805A1FEC:
			case 0x805A2FF4:
				message = this.bundle.GetStringFromName('NS_ERROR_UNKNOWN_CERTIFICATE');
				break;
			default:
				Components.utils.reportError("0x" + status.toString(16) + " with " + uri);
				if (e) Components.utils.reportError(e);
				message = this.bundle.GetStringFromName('response_failure');
		}
		this.addItemToList((status != 0x804B001E ? "failed" : "dns"), message, uri, id);
	}
};

//Implements timeout mechanism
var CheckPlacesTimer = {
	Ci: Components.interfaces,
	Cc: Components.classes,
	timer: null,
	timeout: 30000,
	count: 0,

	init: function(timeout) {
		//cancel any existing timer
		if (this.timer) this.timer.cancel();

		//Create a timer to check every 5 seconds
		this.timeout = timeout * 1000;
		this.timer = this.Cc["@mozilla.org/timer;1"]
										 .createInstance(this.Ci.nsITimer);
		this.timer.init(this, 5000,
										this.Ci.nsITimer.TYPE_REPEATING_SLACK);
	},

	cancel: function() {
		if (this.timer) this.timer.cancel();
	},

  observe: function(subject, topic, data) {
  	if (topic == "timer-callback" && subject == this.timer) {
			var cpp = CheckPlacesProgress;
			if (!cpp.cancelled && cpp.liveLinks && cpp.liveLinks.length) {
				//Has the leg_links count changed since last check?
				//If so, then carry on
				if (this.count != cpp.liveLinks.length) {
					this.count = cpp.liveLinks.length;
				}

				//If no change since last time then some may be stuck so attempt to cancel the oldest
				else {
					var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
													.getService(Components.interfaces.nsIStringBundleService)
													.createBundle("chrome://checkplaces/locale/checkplaces.properties");
					var currentTime = new Date().getTime();

					//From testing we can safely assume that the oldest are the ones earliest in the array
					var cancelCount = 0;
					for (var i=0; i<cpp.liveLinks.length; i++) {
						var cpn = cpp.liveLinks[i].cpn;
						var elapsed = currentTime - cpn.startTime;
						if (cpn.channel && cpn.channel.isPending() && cpn.startTime && (elapsed > this.timeout)) {
							cpp.addItemToList("failed", bundle.GetStringFromName('timed_out'), cpn.uri, cpp.liveLinks[i].id);
							cpn.cancel();
							this.count--;
							cpp.timedOut++;
							//Just cancel the oldest ones - this is to prevent an OS concurrency limit
							//starting, but then blocking checks before they get a chance to be checked
							if (++cancelCount > 5) break;
						}
					}
				}
			}
  	}
	},

  QueryInterface: function(iid) {
    if (iid.equals(this.Ci.nsIObserver) ||
    		iid.equals(this.Ci.nsISupports)) {
      return this;
    }
    throw this.Cr.NS_ERROR_NO_INTERFACE;
  }
}

