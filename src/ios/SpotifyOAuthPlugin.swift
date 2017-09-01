import Foundation
import SafariServices

@objc(SpotifyOAuthPlugin) class SpotifyOAuthPlugin: CDVPlugin {
    func authorize(_ command: CDVInvokedUrlCommand) {
        let auth = SPTAuth.defaultInstance()!
        
        auth.clientID = command.argument(at: 0) as! String
        auth.redirectURL = URL(string: command.argument(at: 1) as! String)
        auth.tokenSwapURL = URL(string: command.argument(at: 2) as! String)
        auth.requestedScopes = command.argument(at: 3) as! Array
        
        let svc = SFSafariViewController(url: auth.spotifyWebAuthenticationURL())
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
            
            auth.handleAuthCallback(withTriggeredAuthURL: url) { (err, sess) in
                guard err == nil else {
                    let res = CDVPluginResult(
                        status: CDVCommandStatus_ERROR,
                        messageAs: [
                            "type": "auth_failed",
                            "msg": err!.localizedDescription
                        ]
                    )
                    
                    self.commandDelegate.send(res, callbackId: command.callbackId)
                    return
                }
                
                let res = CDVPluginResult(
                    status: CDVCommandStatus_OK,
                    messageAs: [
                        "access_token": sess!.accessToken,
                        "encrypted_refresh_token": sess!.encryptedRefreshToken,
                        "expires_in": sess!.expirationDate.timeIntervalSinceNow * 1000
                    ]
                )
                
                self.commandDelegate.send(res, callbackId: command.callbackId)
            }
        }
        
        self.viewController.present(svc, animated: true)
    }
}