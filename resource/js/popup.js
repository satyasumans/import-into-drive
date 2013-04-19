
(function()
{

	/**
	 * Global function to get basename of a path.
	 *
	 * @param {string} path An URL resource
	 * @return {string} The basename of the path
	 */
	var	basename = function (path)
	{
		return path.replace(/\\/g,'/').replace( /.*\//, '' );
	};

	/**
	 * The importer object
	 */
	var ChromeImporter = function (){};

	/**
	 * Display a message into the popup.
	 *
	 * @param {string} message A message
	 */
	ChromeImporter.prototype.displayMessage = function ( message )
	{
		$('#infobox').html(message);
	};

	/**
	 * Display a progress info into the popup.
	 *
	 * @param {json} info Progress information
	 */
	ChromeImporter.prototype.displayProgress = function ( info )
	{
		var p = $('#infoprogress');

		p.show().attr('value', 100 * info.value / info.max);

		if (info.value >= info.max)
			p.stop().hide().attr('min', '0');
	};

	/**
	 * Download a file from the current tab URL and put it into Google Drive
	 */
	ChromeImporter.prototype.downloadUrl = function ()
	{
		var me = this;

		chrome.tabs.getSelected(null, function(tab)
		{
			// Store file
			var file = {
				name: $('<div />').html(basename(tab.url)).text(),
				path: tab.url
			};

			// Display a message into the popup
			me.displayMessage('Downloading <strong>'+file.name+'</strong>...');

			// Store a message to download
			var message = {
				action: 'putFileOnGoogleDrive',
				file: file,
				tab: tab.id
			};

			// Delay
			setTimeout(function()
			{
				// Display a message into the popup
				me.displayMessage('Uploading <strong>'+file.name+'</strong> into your Drive...');

				// Sent the request to the background events
				chrome.extension.sendMessage(message, function(response)
				{
					if (response && response.messageHtml)
					{
						me.displayMessage(response.messageHtml);

						setTimeout(function()
						{
							window.close();
						}, 3000);
					}
				});
			}, 500);
		});
	};

	/**
	 * Load the extension action
	 */
	document.addEventListener('DOMContentLoaded', function ()
	{
		// Connect to the background event page
		chrome.extension.connect(chrome.i18n.getMessage('@@extension_id'));

		// Create the Chrome Importer
		var chromeImporter = new ChromeImporter();

		// Add a listener to catch progression information
		chrome.extension.onMessage.addListener(function(request, sender, sendResponse)
		{
			switch (request.action)
			{
				case 'updateProgressInformation':
					chromeImporter.displayProgress({
						value: request.progress.value,
						max: request.progress.total
					});
					break;
			}

			return false;
		});

		// Display a default empty message and start the download
		chromeImporter.displayMessage('');
		chromeImporter.downloadUrl();
	});

})();
