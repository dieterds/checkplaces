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
 * Portions created by the Initial Developer are Copyright (C) 2010-2011
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

var CheckPlacesExcluded = {
	excludedList: [],
	stopDisplay: false,

	onDialogLoad: function() {
		//Populate the excluded list by running a query and getting the annos
		//Pinch from progress.js and add all the failedItem properties as per progress.js
		try {
			var items = PlacesUtils.annotations
														 .getItemsWithAnnotation(CheckPlacesResults.EXCLUDE_ANNO, {});

			var displayList = document.getElementById('excludedList');
			for (var i = 0; i < items.length; i++) {
				var uri = null //null for folder, feedURI.spec
				var type = null;
				try {
					type = PlacesUtils.bookmarks.getItemType(items[i]);
					if (type != PlacesUtils.bookmarks.TYPE_FOLDER) {
						if (PlacesUtils.livemarks.isLivemark(items[i])) {
							uri = PlacesUtils.livemarks.getFeedURI(items[i]).spec;
						}
						else {
							uri = PlacesUtils.bookmarks.getBookmarkURI(items[i]).spec;
						}
					}
				} catch(e2) {
				}

				var excludedItem = CheckPlacesProgress.getItemDetails(null, uri, items[i],
															CheckPlacesProgress.prefs.getBoolPref("debug"));
				this.excludedList.push(excludedItem);
				displayList.appendItem(excludedItem.name);
			}
		} catch (e) {
		}
		this.displayDetails();
	},

	displayDetails: function() {
		if (this.stopDisplay) return;	//Prevent multiple firings

		if (!CheckPlacesResults.displayDetails('excludedList', this.excludedList)) {
			//Display the first item if none selected
			this.stopDisplay = false;
			var displayList = document.getElementById('excludedList');
			displayList.selectItem(displayList.getItemAtIndex(0));
		}
	},

	openBookmark: function() {
		CheckPlacesResults.openBookmark('excludedList', this.excludedList);
	},

	restoreBookmark: function() {
		//Prevent multiple display updates
		this.stopDisplay = true;

		CheckPlacesResults.restoreBookmark('excludedList', this.excludedList);

		//Display once again
		this.stopDisplay = false;
		this.displayDetails();
	},

	restoreBookmarks: function() {
		//Prevent multiple display updates
		this.stopDisplay = true;

		CheckPlacesResults.restoreBookmarks('excludedList', this.excludedList);

		//Display once again
		this.stopDisplay = false;
		this.displayDetails();
	}
}
