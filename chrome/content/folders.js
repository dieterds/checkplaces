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

var CheckPlacesFolders = {
	prefs: Components.classes["@mozilla.org/preferences-service;1"]
									 .getService(Components.interfaces.nsIPrefService)
									 .getBranch("extensions.checkplaces."),
	include: true,

	onDialogLoad: function() {
		//Are we selecting folders to include or exclude?
		this.include = window.arguments[0].inn.include;

		//Get the currently selected Folder IDs
		var currentIDs = this.prefs.getCharPref(this.include ? "include_folder_ids" : "exclude_folder_ids").split(",");

		//Run the query
		var options = PlacesUtils.history.getNewQueryOptions();
		options.excludeItems = true;
		options.excludeQueries = true;
		options.excludeReadOnlyFolders = true;
		var query = PlacesUtils.history.getNewQuery();
		query.setFolders([PlacesUtils.placesRootId], 1);
		var result = PlacesUtils.history.executeQuery(query, options);

		//Populate the tree
		var tree = document.getElementById("folders");
		tree.place = PlacesUtils.history.queriesToQueryString([query], 1, options);

		//Highlight the current selection
		if (currentIDs && currentIDs.length && currentIDs[0]) {
			//Get all the paths to the current selections
			var parents = [];
			for (var i=0; i<currentIDs.length; i++) {
				var parent = currentIDs[i];
				do {
					parent = PlacesUtils.bookmarks.getFolderIdForItem(parent);
					parents.push(parent);
				} while (parent != PlacesUtils.placesRootId);
			}

			//Go down the tree opening up the parent folders
			var currentRows = [];
			for (var i = 0; i < tree.view.rowCount; i++) {
				//Select the row so I can get at it's id to see if it's a parent
				tree.view.selection.select(i);
				var id = tree.selectedNode.itemId;

				//If it's the final thing, save it
				for (var j=0; j<currentIDs.length; j++) {
					if (id == currentIDs[j]) currentRows.push(i);
				}

				//If it's a parent open it
				var isParent = false;
				for (var j=0; j<parents.length; j++) {
					if (id == parents[j]) isParent = true;
				}
				if (isParent && !tree.view.isContainerOpen(i)) tree.view.toggleOpenState(i);
				else if (!isParent && tree.view.isContainerOpen(i)) tree.view.toggleOpenState(i);
			}

			//Select after messing around otherwise the selection gets changed
			tree.view.selection.select(currentRows[0]);
			for (var i=1; i<currentRows.length; i++) {
				tree.view.selection.toggleSelect(currentRows[i]);
			}
		}
		//If no current item then don't select anything
	},

	//Check for tags folder or child of tags folder
	tagsFolderItem: function(id) {
		while (id != PlacesUtils.placesRootId) {
			if (id == PlacesUtils.tagsFolderId) return true;
			id = PlacesUtils.bookmarks.getFolderIdForItem(id);
		}
		return false;
	},

	//Save the selected folders (if any)
	saveFolders: function() {
		var ids = "";
		var nodes = null;
		var folders = document.getElementById("folders");
		try {
			nodes = folders.selectedNodes;	//Firefox 4+
		} catch(e) {
		}
		if (!nodes) {
			try {
				nodes = folders.getSelectionNodes();	//Firefox 3.x
			} catch(e) {
			}
		}
		var foundTagItem = false;
		if (nodes && nodes.length) {
			var firstTime = true;
			for (var j=0; j<nodes.length; j++) {
				var id = nodes[j].itemId;
				if (!this.tagsFolderItem(id)) {
					if (firstTime) {
						ids = id;
						firstTime = false;
					}
					else
						ids += "," + id;
				}
				else
					foundTagItem = true;
			}
		}
		//If nothing selected send back ""

		//Moan about tags
		if (foundTagItem) {
			var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
	           					.getService(Components.interfaces.nsIStringBundleService)
           						.createBundle("chrome://checkplaces/locale/checkplaces.properties");
			var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
														 .getService(Components.interfaces.nsIPromptService);
			prompt.alert(null, bundle.GetStringFromName('dialog_title'), bundle.GetStringFromName('no_tags_allowed'));
		}

		//Save the IDs in a preference
		this.prefs.setCharPref((this.include ? "include_folder_ids" : "exclude_folder_ids"), ids);
		return true;
	}
};
