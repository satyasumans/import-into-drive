
(function()
{

	/**
	 * This is the GoogleDriveUploader
	 */
	var GoogleDriveUploader = function ()
	{
		// Google Drive API URL
		this.apiUrl = 'https://www.googleapis.com/drive/v2/files';

		// Google Drive upload URL
		this.uploadUrl = 'https://www.googleapis.com/upload/drive/v2/files?uploadType=resumable';
	};

	/**
	 * Download a file from the current tab URL and put it into Google Drive
	 *
	 * @param {json} file A JSON object
	 * @param {function} callback The callback function
	 */
	GoogleDriveUploader.prototype.uploadFile = function ( file, responseCallback )
	{
		var me = this;

		me._authenticateUser(function(token)
		{
			var xhr = new XMLHttpRequest();
			xhr.responseType = 'blob';
			xhr.open('GET', file.path);

			xhr.onload = function()
			{
				me._createFolder({
					filename: 'Chrome Upload',
					token: token
				}, function(parentFolder)
				{
					console.log(parentFolder);
					me._putOnDrive({
						blob: xhr.response,
						filename: file.name,
						mimetype: xhr.getResponseHeader('Content-Type'),
						parent: parentFolder,
						token: token
					}, responseCallback);
				});
			};

			xhr.send();
		});
	};

	/**
	 * Authenticate the current user into their Google Account, and authorize this plugin
	 * to put file into its Google Drive account.
	 *
	 * @param {function} responseCallback The callback
	 */
	GoogleDriveUploader.prototype._authenticateUser = function ( responseCallback )
	{
		var me = self;

		chrome.experimental.identity.getAuthToken({ 'interactive': true }, function(token)
		{
			responseCallback(token);
			/*
			var xhr = new XMLHttpRequest();
			xhr.open('GET', 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json');
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.send();
			*/
		});
	};

	/**
	 * Search or create for the import folder.
	 *
	 * @param {json} folder The folder to search for, or create
	 * @param {function} responseCallback The callback
	 */
	GoogleDriveUploader.prototype._createFolder = function ( folder, responseCallback )
	{
		var me = this;

		var xhr = new XMLHttpRequest();
		xhr.open('GET', me.apiUrl+'?maxResults=1&trashed=false&q=title = \''+folder.filename+'\'');
		xhr.setRequestHeader('Authorization', 'Bearer '+folder.token);

		xhr.onload = function()
		{
			var result = JSON.parse(this.response);

			if (result.items.length > 0)
			{
				console.log('1--------------------------------------------')
				console.log(result);
				return responseCallback({id: result.items[0].id});
			}

			var xhr = new XMLHttpRequest();
			xhr.open('POST', me.apiUrl);
			xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
			xhr.setRequestHeader('Authorization', 'Bearer '+folder.token);

			xhr.onload = function()
			{
				var result = JSON.parse(this.response);
				console.log('2--------------------------------------------')
				console.log(result);
				return responseCallback({id: result.id});
			};

			xhr.send(JSON.stringify({
				title: folder.filename,
				parents: [{id: 'root'}],
				mimeType: 'application/vnd.google-apps.folder'
			}));
		};

		xhr.send();
	};

	/**
	 * Upload the file object into Google Drive
	 *
	 * @param {json} file A JSON object
	 * @param {function} responseCallback The response callback
	 */
	GoogleDriveUploader.prototype._putOnDrive = function ( file, responseCallback )
	{
		var xhr = new XMLHttpRequest();
		xhr.open('POST', this.uploadUrl, true);
		xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
		xhr.setRequestHeader('Authorization', 'Bearer '+file.token);

		xhr.upload.onprogress = function (e)
		{
			sendProgressInformation({
				progress: {
					value: e.loaded,
					total: e.total
				}
			});
		};

		xhr.onload = function()
		{
			if (this.status != 200)
			{
				responseCallback({status: this.status});
			}

			var xhr = new XMLHttpRequest();
			xhr.open('POST', this.getResponseHeader('Location'), true);
			xhr.setRequestHeader('Content-Type', file.mimetype);
			xhr.setRequestHeader('Authorization', 'Bearer '+file.token);

			xhr.upload.onprogress = function (e)
			{
				return sendProgressInformation({
					progress: {
						value: e.loaded,
						total: e.total
					}
				});
			};

			xhr.onload = function()
			{
				return responseCallback({status: this.status});
			};

			xhr.send(file.blob);
		};

		xhr.send(JSON.stringify({
			parents: [file.parent],
			title: file.filename
		}));
	};

	/**
	 * Bind message listener
	 */
	var bindMessageListener = function ()
	{
		// This will indicate if we use notification system instead of message
		var useSystemNotification = false;

		// Function to send notification or message
		var sendResponse = function (response, responseCallback)
		{
			if (!response.message || !response.messageHtml)
			{
				response.message = 'Ouch, an error occurs during the upload :-(';
				response.messageHtml = '<strong>Ouch</strong>, an error occurs during the upload :-(';

				if (response.status == 200)
				{
					response.message = response.file.name+' has been uploaded to your Drive.';
					response.messageHtml = '<strong>'+response.file.name+'</strong> has been uploaded to your Drive.';
				}
			}

			if (useSystemNotification)
			{
				var manifest = chrome.runtime.getManifest();
				var notification = webkitNotifications.createNotification(
					'resource/img/icon-drive-48x48.png', manifest.name, response.message);

				notification.show();

				setTimeout(function()
				{
					notification.cancel();
				}, 7500);
			}
			else
			{
				return responseCallback(response);
			}
		};

		// Add a listener to determine when popup is closed
		chrome.runtime.onConnect.addListener(function(port)
		{
			port.onDisconnect.addListener(function()
			{
				useSystemNotification = true;
			});
		});

		// Add a listener to receive message
		chrome.extension.onMessage.addListener(function(request, sender, responseCallback)
		{
			switch(request.action)
			{

				case 'putFileOnGoogleDrive':

					var googleDriveUploader = new GoogleDriveUploader();

					googleDriveUploader.uploadFile(request.file, function(response)
					{
						response.file = request.file;
						sendResponse(response, responseCallback);
					});

					break;

			};

			return true;
		});
	};

	/**
	 * Send progress information.
	 */
	var sendProgressInformation = function ( info )
	{
		info.action = 'updateProgressInformation';

		chrome.extension.sendMessage(info);
	};

	/**
	 * Authenticate the user when installing the extension.
	 */
	chrome.runtime.onInstalled.addListener(function()
	{
		bindMessageListener();
	});

	/**
	 * Authenticate the user when starting the web browser
	 */
	chrome.runtime.onStartup.addListener(function()
	{
		bindMessageListener();
	});

})();
