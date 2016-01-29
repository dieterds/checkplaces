var self = require("sdk/self");
const {Cc,Ci,Cu} = require("chrome");
var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var tab_utils = require("sdk/tabs/utils");
const {XMLHttpRequest} = require("sdk/net/xhr");
var browserWindows = require("sdk/windows").browserWindows;

Cu.import("resource://gre/modules/Services.jsm");
Services.scriptloader.loadSubScript("chrome://CheckPlaces/content/defaultprefs.js",
                                    {pref:setDefaultPref} );

var button = buttons.ActionButton({
	id: "CheckPlacesButton",
	label: "CheckPlaces",
	icon: {
		"32": self.data.url("icon.png"),
		"64": self.data.url("icon64.png")
	},
	onClick: handleClick
});

function handleClick(state) {	
	var { viewFor } = require("sdk/view/core");
	// get the XUL tab that corresponds to this high-level tab
	var tab = tabs.activeTab;
	var lowLevelTab = viewFor(tab);
	// now we can, for example, access the tab's content directly
	var browsers = tab_utils.getBrowserForTab(lowLevelTab);
	var chromeWindow = viewFor(browserWindows.activeWindow);
	var contentDocument = browsers.contentDocument;

	try
	{
		chromeWindow.openDialog("chrome://checkplaces/content/options.xul", "CheckPlaces", "chrome,centerscreen", contentDocument, browsers);

	}
	catch(error)
	{
		console.log('ERROR');
	}
}

var menuitem = require("menuitem").Menuitem({
	id: "checkplaces-tmenu",
	menuid: "menu_ToolsPopup",
	label: "CheckPlaces",
	//accesskey: "y",
	image: self.data.url("icon.png"),
	onCommand: function() {
		handleClick();
	}
});

var bmenuitem = require("menuitem").Menuitem({
	id: "checkplaces-bmenu",
	menuid: "bookmarksMenuPopup",
	label: "CheckPlaces",
	//insertbefore: "appmenu_showAllBookmarks",
	//insertbefore: "bookmarksShowAll",
	insertbefore: "organizeBookmarksSeparator",	
	//insertbefore: "menu_bookmarkThisPage",		
	//accesskey: "y",
	image: self.data.url("icon.png"),
	onCommand: function() {
		handleClick();
	}
});


//bookmarksToolbarFolderMenu

//var cmenuitem = require("menuitems").Menuitem({
//	id: "CheckPlaces_Menu2",
//	menuid: "appmenu_bookmarksPopup",
//	label: "CheckPlaces",
//	//accesskey: "y",
//	image: self.data.url("icon.png"),
//	onCommand: function() {
//		handleClick();
//	}
//});


var contextMenu = require("sdk/context-menu");
var contextMenuItem = contextMenu.Item({
	label: "CheckPlaces",
	//accesskey: "y",
	image: self.data.url("icon.png"),
	contentScript: 'self.on("click", function (node, data) {self.postMessage("clicked");});',
	onMessage: handleClick
});


function getGenericPref(branch,prefName)
{
    switch (branch.getPrefType(prefName))
    {
        default:
        case 0:   return undefined;                      // PREF_INVALID
        case 32:  return getUCharPref(prefName,branch);  // PREF_STRING
        case 64:  return branch.getIntPref(prefName);    // PREF_INT
        case 128: return branch.getBoolPref(prefName);   // PREF_BOOL
    }
}
function setGenericPref(branch,prefName,prefValue)
{
    switch (typeof prefValue)
    {
      case "string":
          setUCharPref(prefName,prefValue,branch);
          return;
      case "number":
          branch.setIntPref(prefName,prefValue);
          return;
      case "boolean":
          branch.setBoolPref(prefName,prefValue);
          return;
    }
}
function setDefaultPref(prefName,prefValue)
{
    var defaultBranch = Services.prefs.getDefaultBranch(null);
    setGenericPref(defaultBranch,prefName,prefValue);
}
function getUCharPref(prefName,branch)  // Unicode getCharPref
{
    branch = branch ? branch : Services.prefs;
    return branch.getComplexValue(prefName, Ci.nsISupportsString).data;
}
function setUCharPref(prefName,text,branch)  // Unicode setCharPref
{
    var string = Cc["@mozilla.org/supports-string;1"]
                           .createInstance(Ci.nsISupportsString);
    string.data = text;
    branch = branch ? branch : Services.prefs;
    branch.setComplexValue(prefName, Ci.nsISupportsString, string);
}
