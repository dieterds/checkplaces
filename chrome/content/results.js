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

try {
	Components.utils.import("resource://gre/modules/PlacesUtils.jsm");
} catch(ex) {
	Components.utils.import("resource://gre/modules/utils.js");
}

var CheckPlacesResults = {
	prefs: Components.classes["@mozilla.org/preferences-service;1"]
									 .getService(Components.interfaces.nsIPrefService)
									 .getBranch("extensions.checkplaces."),
	badList: [],
	dnsList: [],
	pageErrorList: [],
	serverErrorList: [],
	noFileList: [],
	failedList: [],
	questionableList: [],
	duplicatesList: [],
	emptyList: [],
	cancelledList: [],
	excludedList: [],
	deletedList: [],
	restoreList: [],
	stopDisplay: false,
	EXCLUDE_ANNO: "checkplaces/exclude",

	onDialogAccept: function() {
		//Update any bookmark properties
		this.updateBookmark();

		//Empty the trash?
		if (this.deletedList.length > 0) {
			var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
	           					.getService(Components.interfaces.nsIStringBundleService)
           						.createBundle("chrome://checkplaces/locale/checkplaces.properties");
			var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
															.getService(Components.interfaces.nsIPromptService);
			var emptyTrash = prompts.confirm(null, bundle.GetStringFromName('confirm_title'),
																			 bundle.GetStringFromName('empty_trash'));
			if (emptyTrash)
				this.emptyTrash();
			else
				return false;		//GO back to the results so they manually review the trash
		}

		return true;
	},

	onDialogLoad: function() {
		function showList(list, id) {
			var tabName = id + "Tab";
			var result = null;
			if (list.length) {
				result = tabName;
				var displayList = document.getElementById(id);
				//Display the URL for duplicates
				for (var i=0; i<list.length; i++) {
					displayList.appendItem(id == "duplicatesList" ? list[i].uri : list[i].name);
				}
			}
			//Hide the list (except for excludedList and deletedList)
			else if (id != "excludedList" && id != "deletedList") {
				document.getElementById(tabName).hidden = true;
			}
			return result;
		}

		function showCount(list, count) {
			if (count)
				document.getElementById(list + "Count").value = count;
			else {
				document.getElementById(list + "Label").hidden = true;
				document.getElementById(list + "Count").hidden = true;
			}
		}

		//START HERE
		if (window.arguments != null) {
			this.deletedList = [];

			var dbChecked = window.arguments[0].inn.dbChecked;
			var dbCompacted = window.arguments[0].inn.dbCompacted;
			if (!dbChecked && !dbCompacted) {
				document.getElementById("database").hidden = true;
			}
			else {
				var dbCheckFailed = window.arguments[0].inn.dbCheckFailed;
				var dbCompactFailed = window.arguments[0].inn.dbCompactFailed;
				document.getElementById("dbCheckFailed").hidden = !dbCheckFailed;
				document.getElementById("dbCompactFailed").hidden = !dbCompactFailed;

				document.getElementById("dbChecked").hidden = !dbChecked || dbCheckFailed;
				document.getElementById("dbCompacted").hidden = !dbCompacted || dbCompactFailed;
			}

			document.getElementById("bookmarkCount").value = window.arguments[0].inn.bookmarkCount;
			document.getElementById("pageCount").value = window.arguments[0].inn.pageCount;
			document.getElementById("livemarkCount").value = window.arguments[0].inn.livemarkCount;
			document.getElementById("folderCount").value = window.arguments[0].inn.folderCount;
			//See below for excluded count

			//Elapsed time in hundredths of a minute
			document.getElementById("elapsed").value = parseInt(window.arguments[0].inn.elapsed / 600) / 100;

			this.badList = window.arguments[0].inn.badList;
			var firstTab = showList(this.badList, "badList");
			showCount("badList", this.badList.length);

			var failedTab = "failedListsTab";
			this.dnsList = window.arguments[0].inn.dnsList;
			var subTab = showList(this.dnsList, "dnsList");
			showCount("dnsList", this.dnsList.length);
			if (!firstTab && subTab) firstTab = failedTab;

			this.pageErrorList = window.arguments[0].inn.pageErrorList;
			var tab = showList(this.pageErrorList, "pageErrorList");
			showCount("pageErrorList", this.pageErrorList.length);
			if (!subTab) subTab = tab;
			if (!firstTab && subTab) firstTab = failedTab;

			this.serverErrorList = window.arguments[0].inn.serverErrorList;
			tab = showList(this.serverErrorList, "serverErrorList");
			showCount("serverErrorList", this.serverErrorList.length);
			if (!subTab) subTab = tab;
			if (!firstTab && subTab) firstTab = failedTab;

			this.noFileList = window.arguments[0].inn.noFileList;
			tab = showList(this.noFileList, "noFileList");
			showCount("noFileList", this.noFileList.length);
			if (!subTab) subTab = tab;
			if (!firstTab && subTab) firstTab = failedTab;

			this.failedList = window.arguments[0].inn.failedList;
			tab = showList(this.failedList, "failedList");
			showCount("failedList", this.failedList.length);
			if (!subTab) subTab = tab;
			if (!firstTab && subTab) firstTab = failedTab;

			//Hide the failedListsTab
			if (!subTab) {
				document.getElementById("failedListsTab").hidden = true;
				document.getElementById("failedLabel").hidden = true;
			}

			this.questionableList = window.arguments[0].inn.questionableList;
			tab = showList(this.questionableList, "questionableList");
			showCount("questionableList", this.questionableList.length);
			if (!firstTab) firstTab = tab;

			this.duplicatesList = window.arguments[0].inn.duplicatesList;
			tab = showList(this.duplicatesList, "duplicatesList");
			showCount("duplicatesList", this.duplicatesList.length);
			if (!firstTab) firstTab = tab;

			this.emptyList = window.arguments[0].inn.emptyList;
			tab = showList(this.emptyList, "emptyList");
			showCount("emptyList", this.emptyList.length);
			if (!firstTab) firstTab = tab;

			this.cancelledList = window.arguments[0].inn.cancelledList;
			tab = showList(this.cancelledList, "cancelledList");
			showCount("cancelledList", this.cancelledList.length);
			if (!firstTab) firstTab = tab;

			this.excludedList = window.arguments[0].inn.excludedList;
			tab = showList(this.excludedList, "excludedList");
			showCount("excludedList", this.excludedList.length);
			document.getElementById("excludedCount").value = this.excludedList.length;
			if (!firstTab) firstTab = tab;

			//Hide details and show no problems
			//Display the first tab to avoid display issues
			if (firstTab) {
				document.getElementById("no_problems").hidden = true;
				document.getElementById("mainTabs").selectedItem = document.getElementById(firstTab);
				if (firstTab == failedTab) {
					document.getElementById("failedTabs").selectedItem = document.getElementById(subTab);
				}
			}
			else {
				document.getElementById("found").hidden = true;
				document.getElementById("mainTabs").hidden = true;
				document.getElementById("mainPanels").hidden = true;
				document.getElementById("detailsGroup").hidden = true;
			}
		}
	},

	//Save the results to XML
	onDialogSave: function() {
		try {
			//Prompt for place to save file
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, "Select a file to save to", nsIFilePicker.modeSave);
			fp.appendFilters(nsIFilePicker.filterXML);
			var res = fp.show();
			if (res != nsIFilePicker.returnCancel){
				var xmlFile = fp.file;

				//Create the xml file
				var xmlDoc = document.implementation.createDocument("", "checkplaces", null);
				var rootElement = xmlDoc.documentElement;

				//Summary
				this.addSummary(rootElement, xmlDoc);

				//Details
				this.addDetails(rootElement, xmlDoc);

				//Save locally
				var serializer= new XMLSerializer();
				var xmlData = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(xmlDoc);

				var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
														.createInstance(Components.interfaces.nsIFileOutputStream);
				//0x02 = open for writing, 0x08 = create if doesn't exist
				//0x20 = overwrite if does exist
				//0666 = rw-rw-rw-
				fos.init(xmlFile, 0x02 | 0x08 | 0x20, 0666, 0);

				//In UTF-8
				var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
													 .createInstance(Components.interfaces.nsIConverterOutputStream);
				os.init(fos, "UTF-8", 0, "?".charCodeAt(0));
				os.writeString(xmlData);

				os.close();
				fos.close();
				xmlDoc = null;
			}
		} catch (e) {
			alert(e);
		}

		return true;
	},

	addSummary: function(rootElement, xmlDoc) {
		var summary = xmlDoc.createElement("summary");
		rootElement.appendChild(summary);

		var checked = xmlDoc.createElement("checked");
		summary.appendChild(checked);
		this.addDatabase(xmlDoc, checked, "dbChecked", "dbCheckFailed");
		this.addDatabase(xmlDoc, checked, "dbCompacted", "dbCompactFailed");

		this.addElement(xmlDoc, checked, "bookmarkCount");
		this.addElement(xmlDoc, checked, "pageCount");
		this.addElement(xmlDoc, checked, "livemarkCount");
		this.addElement(xmlDoc, checked, "folderCount");
		this.addElement(xmlDoc, checked, "excludedCount");
		this.addElement(xmlDoc, checked, "elapsed");

		var found = xmlDoc.createElement("found");
		summary.appendChild(found);
		var failed = xmlDoc.createElement("failed");
		found.appendChild(failed);
		this.addElement(xmlDoc, failed, "dnsListCount");
		this.addElement(xmlDoc, failed, "pageErrorListCount");
		this.addElement(xmlDoc, failed, "serverErrorListCount");
		this.addElement(xmlDoc, failed, "noFileListCount");
		this.addElement(xmlDoc, failed, "failedListCount");

		this.addElement(xmlDoc, found, "badListCount");
		this.addElement(xmlDoc, found, "questionableListCount");
		this.addElement(xmlDoc, found, "duplicatesListCount");
		this.addElement(xmlDoc, found, "emptyListCount");
		this.addElement(xmlDoc, found, "cancelledListCount");
		this.addElement(xmlDoc, found, "excludedListCount");
	},

	addDatabase: function(xmlDoc, parent, item, failed) {
		var element = xmlDoc.createElement(item);
		parent.appendChild(element);
		var itFailed = !document.getElementById(failed).hidden;
		var done = !document.getElementById(item).hidden || itFailed;
		element.appendChild(xmlDoc.createTextNode(done));
		if (itFailed) element.setAttribute("failed", "true");
	},

	addDetails: function(rootElement, xmlDoc) {
		var details = xmlDoc.createElement("details");
		rootElement.appendChild(details);

		//Failed lists
		var failedLists = xmlDoc.createElement("failedlists");
		details.appendChild(failedLists);
		this.addList(xmlDoc, failedLists, this.dnsList, "dnsList");
		this.addList(xmlDoc, failedLists, this.pageErrorList, "pageErrorList");
		this.addList(xmlDoc, failedLists, this.serverErrorList, "serverErrorList");
		this.addList(xmlDoc, failedLists, this.noFileList, "noFileList");
		this.addList(xmlDoc, failedLists, this.failedList, "failedList");

		//Other lists
		this.addList(xmlDoc, details, this.badList, "badList");
		this.addList(xmlDoc, details, this.questionableList, "questionableList");
		this.addList(xmlDoc, details, this.duplicatesList, "duplicatesList");	//Needs special processing cos has sublist
		this.addList(xmlDoc, details, this.emptyList, "emptyList");
		this.addList(xmlDoc, details, this.cancelledList, "cancelledList");
		this.addList(xmlDoc, details, this.excludedList, "excludedList");
		this.addList(xmlDoc, details, this.deletedList, "deletedList");
	},

	addList: function(xmlDoc, parent, list, listName) {
		var listElement = xmlDoc.createElement(listName.toLowerCase());
		parent.appendChild(listElement);
		for (var index=0; index<list.length; index++) {
			var listItem = xmlDoc.createElement("item");
			listElement.appendChild(listItem);

			//Duplicates have a sublist
			if (listName == "duplicatesList") {
				listItem.setAttribute("name", list[index].uri);
				for (var i=0; i<list[index].dups.length; i++) {
					var dupItem = xmlDoc.createElement("duplicate");
					listItem.appendChild(dupItem);
					var path = list[index].dups[i].path;
					var name = list[index].dups[i].name;
					path = path + " > " + (name ? name : "");
					dupItem.setAttribute("name", path);
					this.addItemDetails(xmlDoc, dupItem, list[index].dups[i]);
				}
			}
			else {
				listItem.setAttribute("name", list[index].name);
				this.addItemDetails(xmlDoc, listItem, list[index]);
			}
		}
	},

	addItemDetails: function(xmlDoc, parent, list) {
		this.addElementValue(xmlDoc, parent, "status", list.status);
		this.addElementValue(xmlDoc, parent, "path", list.path);
		this.addElementValue(xmlDoc, parent, "name", list.name);
		this.addElementValue(xmlDoc, parent, "location", list.uri);
		this.addElementValue(xmlDoc, parent, "id", list.id);
		this.addElementValue(xmlDoc, parent, "dateAdded", list.dateAdded ? new Date(list.dateAdded/1000).toLocaleString() : "");
		this.addElementValue(xmlDoc, parent, "lastModified", list.lastModified);
		this.addElementValue(xmlDoc, parent, "tags", list.tags);
		this.addElementValue(xmlDoc, parent, "keyword", list.keyword);
		this.addElementValue(xmlDoc, parent, "description", list.description);
	},

	addElement: function(xmlDoc, parent, item) {
		this.addElementValue(xmlDoc, parent, item, document.getElementById(item).value);
	},

	addElementValue: function(xmlDoc, parent, item, pcData) {
		var newElement = xmlDoc.createElement(item.toLowerCase());
		if (pcData) newElement.appendChild(xmlDoc.createTextNode(pcData));
		parent.appendChild(newElement);
	},

	//IF update this method then check excluded.js still works
	displayDetails: function(listName, extList) {
		//Prevent multiple firings
		if (!extList && this.stopDisplay) return;

		//Update any bookmark properties
		if (!extList) this.updateBookmark();

		//Get the current list and selections
		var displayList = document.getElementById(listName);
		var selectedItems = displayList.selectedItems;

		//If just one selected then display details
		if (selectedItems && selectedItems.length) {
			this.showButtons(listName, true);
			var index = displayList.getIndexOfItem(selectedItems[selectedItems.length-1]);
			var list = extList ? extList : this.getList(listName);

			//path
			document.getElementById("path").value = list[index].path;

			//name
			var name = list[index].name;
			if (name) {
				document.getElementById("name").value = name;
				if (!extList) document.getElementById("name").removeAttribute("readonly");
			}
			else {
				document.getElementById("name").value = "";
				document.getElementById("name").setAttribute("readonly", "true");
			}

			//location
			var uri = list[index].uri;
			if (uri) {
				document.getElementById("location").value = uri;
				if (!extList) document.getElementById("location").removeAttribute("readonly");
			}
			else {
				if (listName == "excludedList") {
					document.getElementById("open_excluded").disabled = true;
				}
				else if (listName == "deletedList") {
					document.getElementById("open_deleted").disabled = true;
				}
				document.getElementById("location").value = "";
				document.getElementById("location").setAttribute("readonly", "true");
			}

			if (!extList) {
				//status
				document.getElementById("status").value = list[index].status;

				//id
				document.getElementById("id").value = list[index].id;

				//dates
				if (list[index].dateAdded) {
					var dateAdded = new Date(list[index].dateAdded/1000).toLocaleString();
					document.getElementById("date_added").value = dateAdded;
				}
				else {
					document.getElementById("date_added").value = "";
				}
				document.getElementById("last_modified").value = list[index].lastModified ? list[index].lastModified : "";

				//tags
				document.getElementById("tags").value = list[index].tags ? list[index].tags : "";

				//keyword
				document.getElementById("keyword").value = list[index].keyword ? list[index].keyword : "";

				//description
				document.getElementById("description").value = list[index].description ? list[index].description : "";

				//Temporarily store the listname and the index in prefs in case location changes
				this.prefs.setCharPref("listName", listName);
				this.prefs.setIntPref("index", index);
			}
		}
		//Select the first one (which should cause this method to be called again)
		else if (displayList.itemCount > 0) {
			displayList.currentIndex = 0;
			if (!extList) {
				this.stopDisplay = false;
				displayList.selectItem(displayList.getItemAtIndex(0));
			}
			//For excluded.js calls
			else
				return false;
		}
		//If get to here then list is empty
		else {
			if (!extList) {
				try {
					this.prefs.clearUserPref("listName");
					this.prefs.clearUserPref("index");
				} catch(e) {}
			}
			this.clearDetails(extList);
			this.showButtons(listName, false);
		}
		return true;
	},

	clearDetails: function(extList) {
		document.getElementById("path").value = "";
		document.getElementById("name").value = "";
		document.getElementById("name").setAttribute("readonly", "true");
		document.getElementById("location").value = "";
		document.getElementById("location").setAttribute("readonly", "true");
		if (!extList) {
			document.getElementById("status").value = "";
			document.getElementById("id").value = "";
			document.getElementById("date_added").value = "";
			document.getElementById("last_modified").value = "";
			document.getElementById("keyword").value = "";
			document.getElementById("tags").value = "";
			document.getElementById("description").value = "";
		}
	},

	displayDuplicates: function() {
		if (this.stopDisplay) return;	//Prevent multiple firings

		//Update any bookmark properties
		this.updateBookmark();
		try {
			this.prefs.clearUserPref("listName");
			this.prefs.clearUserPref("index");
		} catch(e) {}

		//Clear the current sublist
		this.stopDisplay = true;
		var displaySubList = document.getElementById("duplicatesSubList");
		if (displaySubList.itemCount) {
			for (var i=displaySubList.itemCount-1; i>-1; i--) {
				displaySubList.removeItemAt(i);
			}
		}
		document.getElementById("delete_duplicates").disabled = false;

		//Get the current list and selections
		var displayList = document.getElementById("duplicatesList");
		var selectedItems = displayList.selectedItems;
		var list = this.getList("duplicatesList");

		//If just one selected then display details of all duplicates in the small box
		if (selectedItems && selectedItems.length) {
			this.showButtons("duplicatesList", true);
			var index = displayList.getIndexOfItem(selectedItems[selectedItems.length-1]);

			//Populate the sublist
			for (var i=0; i<list[index].dups.length; i++) {
				var path = list[index].dups[i].path;
				var name = list[index].dups[i].name;
				path = path + " > " + (name ? name : "");
				displaySubList.appendItem(path);
			}

			//Select first item in sublist
			this.stopDisplay = false;
			this.displayDuplicatesSubList()
		}
		//Select the first one (which should cause this method to be called)
		else if (displayList.itemCount > 0) {
			displayList.currentIndex = 0;
			this.stopDisplay = false;	//So that this method is called again and does something
			displayList.selectItem(displayList.getItemAtIndex(0));
		}
		//If get to here then list is empty
		else {
			this.clearDetails(true);
			this.showButtons("duplicatesList", false);
			this.showButtons("duplicatesSubList", false);
		}
		this.stopDisplay = false;
	},

	displayDuplicatesSubList: function() {
		if (this.stopDisplay) return;	//Prevent multiple firings

		//Update any bookmark properties
		this.updateBookmark();
		try {
			this.prefs.clearUserPref("listName");
			this.prefs.clearUserPref("index");
		} catch(e) {}

		//Get the current list and selections
		var displayList = document.getElementById("duplicatesSubList");
		var selectedItems = displayList.selectedItems;

		//Display details of the selected item
		if (selectedItems && selectedItems.length) {
			this.showButtons("duplicatesSubList", true);

			//If only one in the list or everything selected, then disable the delete button
			document.getElementById("delete_duplicates").disabled = (displayList.itemCount == 1 || displayList.itemCount == selectedItems.length);

			var index = displayList.getIndexOfItem(selectedItems[selectedItems.length-1]);
			var list = this.getList("duplicatesList");
			var parentDisplayList = document.getElementById("duplicatesList");
			var parentSelectedItems = parentDisplayList.selectedItems;
			var parentIndex = parentDisplayList.getIndexOfItem(parentSelectedItems[parentSelectedItems.length-1]);

			var item = list[parentIndex].dups[index];
			document.getElementById("id").value = item.id;
			document.getElementById("status").value = list[parentIndex].dups.length;
			document.getElementById("path").value = item.path;
			document.getElementById("name").value = item.name ? item.name : "";
			document.getElementById("name").setAttribute("readonly", "true");	//Dont allow editing with duplicates
			document.getElementById("location").value = item.uri ? item.uri : "";
			document.getElementById("location").setAttribute("readonly", "true"); //Dont allow editing with duplicates
			if (item.dateAdded) {
				var dateAdded = new Date(item.dateAdded/1000).toLocaleString();
				document.getElementById("date_added").value = dateAdded;
			}
			else {
				document.getElementById("date_added").value = "";
			}
			document.getElementById("last_modified").value = item.lastModified ? item.lastModified : "";
			document.getElementById("tags").value = item.tags ? item.tags : "";
			document.getElementById("keyword").value = item.keyword ? item.keyword : "";
			document.getElementById("description").value = item.description ? item.description : "";
		}
		//Select the first one (which should cause this method to be called)
		else if (displayList.itemCount > 0) {
			displayList.currentIndex = 0;
			this.stopDisplay = false;	//So that this method is called again and does something
			displayList.selectItem(displayList.getItemAtIndex(0));
		}
		//If get to here then list is empty
		else {
			this.clearDetails(true);
			this.showButtons("duplicatesSubList", false);
		}
	},

	//Enable/Disable buttons as appropriate
	//IF update this method then check excluded.js still works
	showButtons: function(listName, enable) {
		if (listName == "duplicatesSubList") {
			document.getElementById("delete_duplicates").disabled = !enable;
			document.getElementById("exclude_dups").disabled = !enable;
		}
		else if (listName == "duplicatesList") {
			document.getElementById("open_dups").disabled = !enable;
			document.getElementById("delete_dups").disabled = !enable;
			document.getElementById("excludeall_dups").disabled = !enable;
		}
		else if (listName == "emptyList") {
			document.getElementById("delete_empty").disabled = !enable;
			document.getElementById("deleteall_empty").disabled = !enable;
			document.getElementById("exclude_empty").disabled = !enable;
			document.getElementById("excludeall_empty").disabled = !enable;
		}
		else if (listName == "excludedList") {
			document.getElementById("open_excluded").disabled = !enable;
			document.getElementById("included_excluded").disabled = !enable;
			document.getElementById("includeall_excluded").disabled = !enable;
		}
		else if (listName == "deletedList") {
			document.getElementById("open_deleted").disabled = !enable;
			document.getElementById("restore_deleted").disabled = !enable;
			document.getElementById("restoreall_deleted").disabled = !enable;
		}
		else {
			document.getElementById("open_" + listName).disabled = !enable;
			document.getElementById("delete_" + listName).disabled = !enable;
			document.getElementById("deleteall_" + listName).disabled = !enable;
			document.getElementById("exclude_" + listName).disabled = !enable;
			document.getElementById("excludeall_" + listName).disabled = !enable;
			if (listName == "questionableList") {
				document.getElementById("fix_" + listName).disabled = !enable;
				document.getElementById("fixall_" + listName).disabled = !enable;
			}
		}
	},

	updateBookmark: function() {
		try {
			var oldListName =	this.prefs.getCharPref("listName");
			if (oldListName) {
				var index =	this.prefs.getIntPref("index");
				var list = this.getList(oldListName);

				try {
					//Has name changed?
					var name = document.getElementById("name").value;
					if (name && name != list[index].name) {
						var displayList = document.getElementById(oldListName);
						PlacesUtils.bookmarks.setItemTitle(list[index].id, name);

						//Update the list and the display
						list[index].name = name;
						displayList.removeItemAt(index);
						displayList.insertItemAt(index, name);
					}

					//If location has changed then save it
					var location = document.getElementById("location").value;
					if (location && location != list[index].uri) {
						PlacesUtils.bookmarks.changeBookmarkURI(list[index].id, PlacesUtils._uri(location));
						list[index].uri = location;
					}

				} catch (e) {
					//If fails user has probably deleted using Organiser, so just remove it from display
					list.splice(index, 1);
					displayList.removeItemAt(index);
				}
			}
		} catch (e) {
			//Will fail when there are no results to display
		}
	},

	fixBookmark: function() {
		var listName = "questionableList";
		var displayList = document.getElementById(listName);
		var selectedItems = displayList.selectedItems;
		if (selectedItems && selectedItems.length) {
			//Prevent any name/location and multiple display updates
			this.stopDisplay = true;

			//Go through the list looking for 301s
			var list = this.getList(listName);
			for (var i=selectedItems.length-1; i>-1; i--) {
				var index = displayList.getIndexOfItem(selectedItems[i]);

				//If 301, extract the new location
				if (list[index].status.match(/^301 : /)) {
					//If location has changed then save it
					var newLocation = list[index].status.substring(6);
					if (newLocation && newLocation != list[index].uri) {
						try {
							PlacesUtils.bookmarks.changeBookmarkURI(list[index].id, PlacesUtils._uri(newLocation));
							list[index].uri = newLocation;
						} catch (e) {
							//If fails user has probably deleted using Organiser, so just ignore it
						}
					}
				}
			}

			//Redisplay the details of the current item in case it has changed
			this.stopDisplay = false;
			try {
				this.prefs.clearUserPref("listName");
				this.prefs.clearUserPref("index");
			} catch(e) {}
			this.displayDetails(listName);
		}
	},

	fixBookmarks: function() {
		//Prevent any name/location and multiple display updates
		this.stopDisplay = true;

		var listName = "questionableList";
		var list = this.getList(listName);
		if (list && list.length) {
			var displayList = document.getElementById(listName);

			//Go through the list looking for 301s
			for (var i=list.length-1; i>-1; i--) {

				//If 301, extract the new location
				if (list[i].status.match(/^301 : /)) {
					//If location has changed then save it
					var newLocation = list[i].status.substring(6);
					if (newLocation && newLocation != list[i].uri) {
						try {
							PlacesUtils.bookmarks.changeBookmarkURI(list[i].id, PlacesUtils._uri(newLocation));
							list[i].uri = newLocation;
						} catch (e) {
							//If fails user has probably deleted using Organiser, so just ignore it
						}
					}
				}
			}
		}

		//Display once again
		this.stopDisplay = false;
		try {
			this.prefs.clearUserPref("listName");
			this.prefs.clearUserPref("index");
		} catch(e) {}
		this.displayDetails(listName);
	},

	//Note - doesnt apply for duplicates
	deleteBookmark: function(listName) {
		var displayList = document.getElementById(listName);
		var selectedItems = displayList.selectedItems;
		if (selectedItems && selectedItems.length) {
			//Prevent any name/location and multiple display updates
			this.stopDisplay = true;

			var index = -1;
			var list = this.getList(listName);

			//Loop backwards otherwise displayList index will be wrong
			//as you remove things from it
			for (var i=selectedItems.length-1; i>-1; i--) {
				index = displayList.getIndexOfItem(selectedItems[i]);
				this.addToDeleted(list[index], listName);

				//Remove from the list and display
				list.splice(index, 1);
				displayList.removeItemAt(index);
			}

			//Select the next one in the list (or the first one)
			if (index != -1 && displayList.itemCount > 0) {
				if (index > displayList.itemCount-1) index = 0;
				displayList.selectItem(displayList.getItemAtIndex(index));
				displayList.currentIndex = index;
			}

			//Display the details (without changing anything)
			this.stopDisplay = false;
			try {
				this.prefs.clearUserPref("listName");
				this.prefs.clearUserPref("index");
			} catch(e) {}
			this.displayDetails(listName);
		}
	},

	//Note - doesnt apply for duplicates
	deleteBookmarks: function(listName) {
		//Prevent any name/location and multiple display updates
		this.stopDisplay = true;

		var list = this.getList(listName);

		if (list && list.length) {
			var displayList = document.getElementById(listName);
			//loop backwards or else removeAtItem's index will be wrong (cos everything shifts up one)
			for (var i=list.length-1; i>-1; i--) {
				displayList.removeItemAt(i);
				this.addToDeleted(list[i], listName);
				list.splice(i, 1);
			}
		}

		//Display once again
		this.stopDisplay = false;
		this.displayDetails(listName);
	},

	//Delete duplicates from the sublist
	deleteDuplicate: function() {
		var displaySubList = document.getElementById("duplicatesSubList");
		var selectedSubItems = displaySubList.selectedItems;
		if (selectedSubItems && selectedSubItems.length) {
			//Prevent any name/location and multiple display updates
			this.stopDisplay = true;

			//Get the "master" duplicate item to update
			var list = this.getList("duplicatesList");
			var displayList = document.getElementById("duplicatesList");
			var selectedItems = displayList.selectedItems;
			var index = displayList.getIndexOfItem(selectedItems[0]);
			var subIndex = displaySubList.getIndexOfItem(selectedSubItems[0]);

			//Add to the deleted list then remove it
			this.addToDeleted(list[index].dups[subIndex], "duplicatesList");

			//Remove from the display and update the list
			displaySubList.removeItemAt(subIndex);
			list[index].dups.splice(subIndex, 1);
			this.stopDisplay = false;
			this.displayDuplicatesSubList();
		}
	},

	//Delete everything in the duplicates sub lists (but keeping at least one of each duplicate)
	//If the dateAdded are the same use the lastModified, if these are the same then delete the first/last in the list
	deleteDuplicates: function(keepFirst) {
		function sortByDate(a, b) {
			//Sort by date
			if (a.dateAdded < b.dateAdded)
				return -1;
			else if (a.dateAdded > b.dateAdded)
				return 1;
			else return 0;
		}

		//Clear the current sublist
		this.stopDisplay = true;
		var displaySubList = document.getElementById("duplicatesSubList");
		if (displaySubList.itemCount) {
			for (var i=displaySubList.itemCount-1; i>-1; i--) {
				displaySubList.removeItemAt(i);
			}
		}

		var list = this.getList("duplicatesList");
		if (list && list.length) {
			var displayList = document.getElementById("duplicatesList");

			//Loop backwards otherwise displayList index will be wrong
			for (var i=list.length-1; i>-1; i--) {
				//Sort dups by date added
				var dups = list[i].dups;
				dups.sort(sortByDate);

				//Remove all but one duplicate
				//This will keep the earliest if they are date ordered
				for (var j = dups.length-1; j>0; j--) {
					this.addToDeleted(list[i].dups[j], "duplicatesList");
				}
				//Add the remaining one to a special list so it can be restored
				list[i].dups[0].origList = "duplicatesList";
				this.restoreList.push(list[i].dups[0]);

				//Remove from list/display
				displayList.removeItemAt(i);
				list.splice(i, 1);
			}
		}

		//Display once again
		this.stopDisplay = false;
		this.displayDuplicates();
	},

	addToDeleted: function(item, list) {
		//Add to deleted list
		item.origList = list;
		item.folder = (list == "emptyList");
		this.deletedList.push(item);

		//Add to the display
		var displayList = document.getElementById("deletedList");
		displayList.appendItem(item.name);
	},

	excludeBookmark: function(listName) {
		var displayList = document.getElementById(listName);
		var selectedItems = displayList.selectedItems;
		if (selectedItems && selectedItems.length) {
			//Prevent any name/location and multiple display updates
			this.stopDisplay = true;

			var index = -1;
			var list = this.getList(listName);

			//Loop backwards otherwise displayList index will be wrong
			//as you remove things from it
			for (var i=selectedItems.length-1; i>-1; i--) {
				index = displayList.getIndexOfItem(selectedItems[i]);
				try {
					PlacesUtils.annotations.setItemAnnotation(list[index].id, this.EXCLUDE_ANNO,
						1, 0, PlacesUtils.annotations.EXPIRE_NEVER);
				} catch (e) {
				}

				//Add to the excluded list
				this.addToExcluded(list[index], listName);

				//Remove from the list and display
				list.splice(index, 1);
				displayList.removeItemAt(index);
			}

			//Select the next one in the list (or the first one)
			if (index != -1 && displayList.itemCount > 0) {
				if (index > displayList.itemCount-1) index = 0;
				displayList.selectItem(displayList.getItemAtIndex(index));
				displayList.currentIndex = index;
			}

			//Display the details (without changing anything)
			this.stopDisplay = false;
			try {
				this.prefs.clearUserPref("listName");
				this.prefs.clearUserPref("index");
			} catch(e) {}
			this.displayDetails(listName);
		}
	},

	excludeBookmarks: function(listName) {
		//Prevent any name/location and multiple display updates
		this.stopDisplay = true;

		var list = this.getList(listName);
		if (list && list.length) {
			var displayList = document.getElementById(listName);
			//loop backwards or else removeAtItem's index will be wrong (cos everything shifts up one)
			for (var i=list.length-1; i>-1; i--) {
				try {
					PlacesUtils.annotations.setItemAnnotation(list[i].id, this.EXCLUDE_ANNO,
						1, 0, PlacesUtils.annotations.EXPIRE_NEVER);
				} catch (e) {
				}
				displayList.removeItemAt(i);

				//Add to the excluded list
				this.addToExcluded(list[i], listName);
				list.splice(i, 1);
			}
		}

		//Display once again
		this.stopDisplay = false;
		this.displayDetails(listName);
	},

	excludeDuplicate: function() {
		var displaySubList = document.getElementById("duplicatesSubList");
		var selectedSubItems = displaySubList.selectedItems;
		if (selectedSubItems && selectedSubItems.length) {
			//Prevent any name/location and multiple display updates
			this.stopDisplay = true;

			//Get the "master" duplicate item to update
			var list = this.getList("duplicatesList");
			var displayList = document.getElementById("duplicatesList");
			var selectedItems = displayList.selectedItems;
			var index = displayList.getIndexOfItem(selectedItems[0]);
			var subIndex = displaySubList.getIndexOfItem(selectedSubItems[0]);

			//Add exclude annotation
			try {
				PlacesUtils.annotations.setItemAnnotation(list[index].dups[subIndex].id,
				  this.EXCLUDE_ANNO, 1, 0, PlacesUtils.annotations.EXPIRE_NEVER);
			} catch (e) {
			}

			//Add to the excluded list
			this.addToExcluded(list[index].dups[subIndex], "duplicatesList");

			//Remove from the display and update the list
			displaySubList.removeItemAt(subIndex);
			list[index].dups.splice(subIndex, 1);

			//If no more sublist items then remove the main item
			if (list[index].dups.length == 0) {
				displayList.removeItemAt(index);
				list.splice(index, 1);
				this.stopDisplay = false;
				this.displayDuplicates();
			}
			else {
				this.stopDisplay = false;
				this.displayDuplicatesSubList();
			}
		}
	},

	excludeDuplicates: function() {
		//Clear the current sublist
		this.stopDisplay = true;
		var displaySubList = document.getElementById("duplicatesSubList");
		if (displaySubList.itemCount) {
			for (var i=displaySubList.itemCount-1; i>-1; i--) {
				displaySubList.removeItemAt(i);
			}
		}

		var list = this.getList("duplicatesList");
		if (list && list.length) {
			var displayList = document.getElementById("duplicatesList");

			//loop backwards or else removeAtItem's index will be wrong (cos everything shifts up one)
			for (var i=list.length-1; i>-1; i--) {
				for (var j=list[i].dups.length-1; j>-1; j--) {
					try {
						PlacesUtils.annotations.setItemAnnotation(list[i].dups[j].id, this.EXCLUDE_ANNO,
							1, 0, PlacesUtils.annotations.EXPIRE_NEVER);
					} catch (e) {
					}

					//Add to the excluded list
					this.addToExcluded(list[i].dups[j], "duplicatesList");
				}
				displayList.removeItemAt(i);
				list.splice(i, 1);
			}
		}

		//Display once again
		this.stopDisplay = false;
		this.displayDuplicates();
	},

	addToExcluded: function(item, list) {
		//Add to excluded list
		item.origList = list;
		this.excludedList.push(item);

		//Add to the display
		var displayList = document.getElementById("excludedList");
		displayList.appendItem(item.name);

		//Show the tab if missing - tab should always be showing to avoid display issues
//		document.getElementById("excludedListTab").hidden = false;
	},

	//IF update this method then check excluded.js still works
	restoreBookmark: function(listName, extList) {
		var include = (listName == "excludedList");
		var displayList = document.getElementById(listName);
		var selectedItems = displayList.selectedItems;
		if (selectedItems && selectedItems.length) {
			//Prevent any name/location and multiple display updates
			if (!extList) this.stopDisplay = true;

			var index = -1;
			var list = extList ? extList : this.getList(listName);

			//Loop backwards otherwise displayList index will be wrong
			//as you remove things from it
			for (var i=selectedItems.length-1; i>-1; i--) {
				index = displayList.getIndexOfItem(selectedItems[i]);
				if (include) {
					try {
						PlacesUtils.annotations
											 .removeItemAnnotation(list[index].id, this.EXCLUDE_ANNO);
					} catch (e) {
					}
				}

				//Put back into the original list it came from (if any)
				if (list[index].origList) this.restoreItem(list[index]);

				//Remove from the list and display
				list.splice(index, 1);
				displayList.removeItemAt(index);
			}

			//Select the next one in the list (or the first one)
			if (index != -1 && displayList.itemCount > 0) {
				if (index > displayList.itemCount-1) index = 0;
				displayList.selectItem(displayList.getItemAtIndex(index));
				displayList.currentIndex = index;
			}

			//Display the details (without changing anything)
			if (!extList) {
				this.stopDisplay = false;
				try {
					this.prefs.clearUserPref("listName");
					this.prefs.clearUserPref("index");
				} catch(e) {}
				this.displayDetails(listName);
			}
		}
	},

	//IF update this method then check excluded.js still works
	restoreBookmarks: function(listName, extList) {
		//Prevent any name/location and multiple display updates
		if (!extList) this.stopDisplay = true;

		var include = (listName == "excludedList");
		var list = extList ? extList : this.getList(listName);
		if (list && list.length) {
			var displayList = document.getElementById(listName);
			//loop backwards or else removeAtItem's index will be wrong (cos everything shifts up one)
			for (var i=list.length-1; i>-1; i--) {
				if (include) {
					try {
						PlacesUtils.annotations
											 .removeItemAnnotation(list[i].id, this.EXCLUDE_ANNO);
					} catch (e) {
					}
				}
				displayList.removeItemAt(i);

				//Put back into the original list it came from (if any)
				if (list[i].origList) this.restoreItem(list[i]);
				list.splice(i, 1);
			}
		}

		//Display once again
		if (!extList) {
			this.stopDisplay = false;
			this.displayDetails(listName);
		}
	},

	restoreItem: function(item) {
		var origDisplayList = document.getElementById(item.origList);
		if (item.origList == "duplicatesList") {
			//Look for an existing 'master' item and add sublist if find it
			var list = this.getList(item.origList);
			var foundDuplicate = false;
			for (var i=0; i<list.length; i++) {
				if (list[i].uri == item.uri) {
					foundDuplicate = true;
					list[i].dups.push(item);
					break;
				}
			}

			//If no master then create one and also restore any sibling lurking about
			if (!foundDuplicate) {
				var duplicate = {};
				duplicate.uri = item.uri;
				duplicate.dups = [];
				for (var i=0; i<this.restoreList.length; i++) {
					if (this.restoreList[i].uri == item.uri) {
						duplicate.dups.push(this.restoreList[i]);
						this.restoreList.splice(i, 1);
						break;
					}
				}
				duplicate.dups.push(item);
				list.push(duplicate);
				origDisplayList.appendItem(item.uri);
			}
		}
		else {
			this.getList(item.origList).push(item);
			origDisplayList.appendItem(item.name);
		}
	},

	//'Really' delete all the items in the trash
	emptyTrash: function() {
			var batch = {
				runBatched: function() {
					for (var i=0; i<CheckPlacesResults.deletedList.length; i++) {
						var id = CheckPlacesResults.deletedList[i].id;
						var folder = CheckPlacesResults.deletedList[i].folder;
						if (folder) {
							try {
								PlacesUtils.bookmarks.removeFolder(id);	//Obsolete in FF4.0
							} catch(e) {
								try {
									PlacesUtils.bookmarks.removeItem(id);
								} catch(e) {
									//Ignore error - user has probably deleted using Organiser
								}
							}
						}
						else {
							try {
								PlacesUtils.bookmarks.removeItem(id);
							} catch (e) {
								//This should be nonsense, but it sometimes gets here pre FF4
								try {
									PlacesUtils.bookmarks.removeFolder(id);	//Obsolete in FF4.0
								} catch(e) {
									//Ignore error - user has probably deleted using Organiser
								}
							}
						}
					}
				}
			}
			PlacesUtils.bookmarks.runInBatchMode(batch, null);
	},

	getList: function(listName) {
		var list = CheckPlacesResults.questionableList;
		if (listName == "badList")
			list = CheckPlacesResults.badList;
		else if (listName == "dnsList")
			list = CheckPlacesResults.dnsList;
		else if (listName == "pageErrorList")
			list = CheckPlacesResults.pageErrorList;
		else if (listName == "serverErrorList")
			list = CheckPlacesResults.serverErrorList;
		else if (listName == "noFileList")
			list = CheckPlacesResults.noFileList;
		else if (listName == "failedList")
			list = CheckPlacesResults.failedList;
		else if (listName == "duplicatesList")
			list = CheckPlacesResults.duplicatesList;
		else if (listName == "emptyList")
			list = CheckPlacesResults.emptyList;
		else if (listName == "cancelledList")
			list = CheckPlacesResults.cancelledList;
		else if (listName == "excludedList")
			list = CheckPlacesResults.excludedList;
		else if (listName == "deletedList")
			list = CheckPlacesResults.deletedList;

		return list;
	},

	//Open bookmark in new tab
	//IF update this method then check excluded.js still works
	openBookmark: function(listName, list) {
		//Display my own style alert
		function openAlert() {
			var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
														.getService(Components.interfaces.nsIStringBundleService)
														.createBundle("chrome://checkplaces/locale/checkplaces.properties");
			var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
															.getService(Components.interfaces.nsIPromptService);
			prompts.alert(null, bundle.GetStringFromName('no_location'), bundle.GetStringFromName('open_alert'));
		}

		var displayList = document.getElementById(listName);
		var selectedItems = displayList.selectedItems;
		if (selectedItems && selectedItems.length) {
			var	thisBrowser = null;
			try {
				thisBrowser = window.opener.getBrowser();

			} catch(e) {
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
										.getService(Components.interfaces.nsIWindowMediator);
				var mainWindow = wm.getMostRecentWindow("navigator:browser");
				thisBrowser = mainWindow.getBrowser();
			}

			if (!list) list = this.getList(listName);
			var shownAlert = false;
			for (var i=0; i<selectedItems.length; i++) {
				var index = displayList.getIndexOfItem(selectedItems[i]);
				if (list[index].uri) {
					var tab = thisBrowser.addTab(list[index].uri);
					thisBrowser.selectedTab = tab;
				}
				else if (!shownAlert) {
					openAlert();
					shownAlert = true;
				}
			}
		}
	},

	//Display the correct details depending on the tab selected
	changeTabs: function() {
		function subTab() {
			var subListName = "failedList";
			var tab = document.getElementById("failedTabs").selectedItem.id;
			if (tab == "dnsListTab")
				subListName = "dnsList";
			else if (tab == "pageErrorListTab")
				subListName = "pageErrorList";
			else if (tab == "serverErrorListTab")
				subListName = "serverErrorList";
			else if (tab == "noFileListTab")
				subListName = "noFileList";

			return subListName;
		}

		var item = document.getElementById("mainTabs").selectedItem;
		var listName = "failedList";
		if (!item) {
			listName = subTab();
		}
		else {
			var tab = item.id;
			if (!tab || tab == "failedListsTab")
				listName = subTab();
			else if (tab == "badListTab")
				listName = "badList";
			else if (tab == "questionableListTab")
				listName = "questionableList";
			else if (tab == "emptyListTab")
				listName = "emptyList";
			else if (tab == "cancelledListTab")
				listName = "cancelledList";
			else if (tab == "excludedListTab")
				listName = "excludedList";
			else if (tab == "deletedListTab")
				listName = "deletedList";
			else if (tab == "duplicatesListTab") {
				this.displayDuplicates();
				return;
			}
		}

		this.displayDetails(listName);
	}
}
