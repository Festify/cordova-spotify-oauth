import Foundation
import SafariServices

extension URL {
    subscript(queryParam: String) -> String? {
        guard let url = URLComponents(string: self.absoluteString) else { return nil }
        return url.queryItems?.first(where: { $0.name == queryParam })?.value
    }
}

@objc(SpotifyOAuthPlugin) class SpotifyOAuthPlugin: CDVPlugin, SFSafariViewControllerDelegate {
    private var currentCommand: CDVInvokedUrlCommand?
    private var currentNsObserver: AnyObject?
    
    @objc(getCode:) func getCode(_ command: CDVInvokedUrlCommand) {
        let clientid = command.argument(at: 0) as! String
        let redirectURL = command.argument(at: 1) as! String
        let requestedScopes = command.argument(at: 4) as! [String]
        
        var components = URLComponents()
        components.scheme = "https"
        components.host = "accounts.spotify.com"
        components.path = "/authorize"
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientid),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURL),
            URLQueryItem(name: "show_dialog", value: "true"),
            URLQueryItem(name: "scope", value: requestedScopes.joined(separator: " ")),
            URLQueryItem(name: "utm_source", value: "spotify-sdk"),
            URLQueryItem(name: "utm_medium", value: "ios-sdk"),
            URLQueryItem(name: "utm_campaign", value: "ios-sdk")
        ]
        
        let svc = SFSafariViewController(url: components.url!)
        
        svc.delegate = self;
        svc.modalPresentationStyle = .overFullScreen
        
        var observer: NSObjectProtocol?
        observer = NotificationCenter.default.addObserver(
            forName: NSNotification.Name.CDVPluginHandleOpenURL,
            object: nil,
            queue: nil
        ) { note in
            let url = note.object as! URL
            guard url.absoluteString.contains("code") else { return }
            
            svc.presentingViewController!.dismiss(animated: true, completion: nil)
            NotificationCenter.default.removeObserver(observer!)
            self.currentNsObserver = nil
            self.currentCommand = nil

            let res = CDVPluginResult(
                status: CDVCommandStatus_OK,
                messageAs: [
                    "code": url["code"]
                ]
            )
            self.commandDelegate.send(res, callbackId: command.callbackId)
        }
        
        self.currentCommand = command
        self.currentNsObserver = observer
        
        self.viewController.present(svc, animated: true)
    }
    
    func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        guard self.currentNsObserver != nil && self.currentCommand != nil else { return }
        
        let res = CDVPluginResult(
            status: CDVCommandStatus_ERROR,
            messageAs: [
                "type": "auth_canceled",
                "msg": "The user cancelled the authentication process."
            ]
        )
        self.commandDelegate.send(res, callbackId: self.currentCommand!.callbackId)
        
        NotificationCenter.default.removeObserver(self.currentNsObserver!)
        self.currentCommand = nil
        self.currentNsObserver = nil
    }
}
