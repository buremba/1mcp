import { tool } from "ai";
import { z } from "zod";

/**
 * Browser API tools that execute locally
 */

export const getGeolocationTool = tool({
	description:
		"Get the user's current geographic coordinates (latitude and longitude). Requires user permission.",
	inputSchema: z.object({}),
	execute: async (_params) => {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error("Geolocation is not supported by this browser"));
				return;
			}

			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
						accuracy: position.coords.accuracy,
						timestamp: new Date(position.timestamp).toISOString(),
					});
				},
				(error) => {
					reject(new Error(`Geolocation error: ${error.message}`));
				},
				{
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0,
				},
			);
		});
	},
});

export const readClipboardTool = tool({
	description:
		"Read text content from the system clipboard. Requires user permission. Useful for getting user input or pasted data.",
	inputSchema: z.object({}),
	execute: async () => {
		try {
			const text = await navigator.clipboard.readText();
			return {
				success: true,
				text,
				length: text.length,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to read clipboard. Permission may be required.",
			};
		}
	},
});

export const writeClipboardTool = tool({
	description:
		"Write text content to the system clipboard. Makes it available for pasting. Requires user permission.",
	inputSchema: z.object({
		text: z.string().describe("The text to copy to clipboard"),
	}),
	execute: async ({ text }) => {
		try {
			await navigator.clipboard.writeText(text);
			return {
				success: true,
				message: `Copied ${text.length} characters to clipboard`,
				length: text.length,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to write to clipboard. Permission may be required.",
			};
		}
	},
});

export const showNotificationTool = tool({
	description:
		"Show a desktop notification to the user. Useful for alerting about completed operations or important events. Requires notification permission.",
	inputSchema: z.object({
		title: z.string().describe("Notification title"),
		body: z.string().optional().describe("Notification body text"),
		icon: z.string().optional().describe("URL to notification icon"),
	}),
	execute: async ({ title, body, icon }) => {
		try {
			if (!("Notification" in window)) {
				return {
					success: false,
					message: "Notifications not supported in this browser",
				};
			}

			if (Notification.permission === "denied") {
				return {
					success: false,
					message: "Notification permission denied",
				};
			}

			if (Notification.permission === "default") {
				const permission = await Notification.requestPermission();
				if (permission !== "granted") {
					return {
						success: false,
						message: "Notification permission not granted",
					};
				}
			}

			new Notification(title, { body, icon });
			return {
				success: true,
				message: "Notification shown",
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},
});

export const getNetworkStatusTool = tool({
	description:
		"Get the current network connection status (online/offline) and connection type if available.",
	inputSchema: z.object({}),
	execute: async () => {
		const online = navigator.onLine;
		const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

		return {
			online,
			effectiveType: connection?.effectiveType,
			downlink: connection?.downlink,
			rtt: connection?.rtt,
			saveData: connection?.saveData,
		};
	},
});

export const getScreenInfoTool = tool({
	description:
		"Get information about the browser viewport and screen dimensions. Useful for UI-related operations.",
	inputSchema: z.object({}),
	execute: async () => {
		return {
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
			screen: {
				width: window.screen.width,
				height: window.screen.height,
				availWidth: window.screen.availWidth,
				availHeight: window.screen.availHeight,
				colorDepth: window.screen.colorDepth,
				pixelDepth: window.screen.pixelDepth,
			},
			devicePixelRatio: window.devicePixelRatio,
		};
	},
});

/**
 * Export all browser tools as a collection
 * Note: File operations (read/write/search) are available via MCP tools from the relay server
 * Time/date operations should use JavaScript Date API directly
 */
export const browserTools = {
	getGeolocation: getGeolocationTool,
	readClipboard: readClipboardTool,
	writeClipboard: writeClipboardTool,
	showNotification: showNotificationTool,
	getNetworkStatus: getNetworkStatusTool,
	getScreenInfo: getScreenInfoTool,
};
