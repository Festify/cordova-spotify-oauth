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
    
    func getCode(_ command: CDVInvokedUrlCommand) {
        let auth = SPTAuth.defaultInstance()!
        
        auth.clientID = command.argument(at: 0) as! String
        auth.redirectURL = URL(string: command.argument(at: 1) as! String)
        auth.requestedScopes = command.argument(at: 2) as! Array
        
        let svc = SFSafariViewController(url: auth.spotifyWebAuthenticationURL())
        svc.delegate = self;
        svc.modalPresentationStyle = .overFullScreen
        
        var observer: NSObjectProtocol?
        observer = NotificationCenter.default.addObserver(
            forName: NSNotification.Name.CDVPluginHandleOpenURL,
            object: nil,
            queue: nil
        ) { note in
            let url = note.object as! URL
            guard auth.canHandle(url) else { return }
            
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
