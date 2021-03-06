Authentication and Authorization guide
======================================

Permanently allowed request types
---------------------------------

This is used to set the default permissions for all incoming requests regardless of any user information.

Currently it is only possible to allow by O-MI request type with this setting.

This setting is intended for testing the node or, for example, allowing "read" and "cancel"
requests when all data in the db is open data.

1. Set `allowRequestTypesForAll` in [configuration](https://github.com/AaltoAsia/O-MI#configuration-location)

Ip Authorization
----------------

This is useful for allowing localhost connections to write. It allows fast and easy setup of simple O-MI wrapper scripts on the same server machine.

1. Set `input-whitelist-ips` in [configuration](https://github.com/AaltoAsia/O-MI#configuration-location)

Subnet Authorization
---------------------

This is aimed for quick low security solution or allowing a subnet of trusted computers to write.

1. Set `input-whitelist-subnets` in [configuration](https://github.com/AaltoAsia/O-MI#configuration-location)


O-MI Auth API v2
-----------------

This can be used to setup external authentication and authorization services (word *external* means a separate process that can run on the same or other computer). O-MI Node first contacts authentication service and then authorization service, after that it filters the request.

The Authentication and Authorization APIs are quite flexible and are controlled by [configuration](https://github.com/AaltoAsia/O-MI#configuration) options in object `omi-service.authAPI.v2`. Only fixed format is the last step, which is the response of Authorization service: It must have json object in the body that has two lists of paths, `"allow"` and `"deny"`. These lists are used to filter the incoming O-DF with following set operations: `<O-DF> intersect <allow> difference <deny>`. The filtered O-DF is used in the request instead of the original and the request processing will continue.

The input for authentication service can be passed by several configurable ways (option `omi-service.authAPI.v2.parameters.fromRequest`):
* omiEnvelope attribute, for example `<omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="0" token="eyJ0eXAiOiJKV1Q...">`, This is the recommended way to ensure functionality even when using other transport protocols.
* The `Authorization` HTTP header
* HTTP Cookie
* Other HTTP headers
* Uri query parameters

Continue reading below to know about already existing implementations of these APIs.

O-MI Authentication and Authorization reference implementations
================================================================

* [Authentication module](https://github.com/AaltoAsia/O-MI-Authentication)
* [Authorization module](https://github.com/AaltoAsia/O-MI-Authorization)

These are examples on how to use Auth API v2 of O-MI Node. They might be secure enough for production use, but use with care. Either of them can be replaced by other software by adjusting the configuration approprietly or implementing a wrapper to fix any larger protocol differences.

## Local User DB, username and password Authentication with JWT session

Start with this to test how the modules work.

**Versions used:**
* O-MI Node: 1.0.2
* O-MI Authentication: 1.0.0
* O-MI Authorization: 1.0.0

**Instructions:**
1. Install [Authentication module](https://github.com/AaltoAsia/O-MI-Authentication)
    * ldap and nginx installations are optional
2. Install [Authorization module](https://github.com/AaltoAsia/O-MI-Authorization)
2. Configure O-MI Node: [application.conf](https://github.com/AaltoAsia/O-MI#configuration-location)
    1. Configure according to the readmes of the modules
    1. If testing with localhost: add option `omi-service.input-whitelist-ips=[]` to disable localhost authorization
    2. *Optional:* In O-MI Node `logback.xml` configuration file, add `<logger name="authorization" level="DEBUG"/>` inside configuration element for debugging
3. Start O-MI Node, Authentication module and Authorization module
4. open authentication module in browser http://localhost:8000/ and press signup
    1. Create a new user and remember the email that was used
    2. Log in with your account
    3. Open About page and copy your token string (carefully, don't copy white space)
5. Open O-MI Node webclient http://localhost:8080/html/webclient/index.html
    1. Create a write request
    2. Send and check that the result is `Unauthorized`
    3. Leave page open
6. Open shell
    1. Install httpie or (the http client of your choice) `sudo apt-get install httpie`
    2. Add your email address as username `http POST :8001/v1/add-user username=your@test.email`
    3. Add allow write rule to your user (automatically created group) `http POST :8001/v1/set-permissions group=your@user.email_USERGROUP permissions:='[{"path":"Objects","request":"wcd","allow":true}]'`
7. Go back to O-MI Node webclient and send again. You should see returnCode=200.


## Read permissions

By default, O-MI Node allows anyone to make any read requests. If some parts of O-DF should be hidden, follow these instructions.

1. Make sure that you have basic installation done as described above.
2. In [application.conf](https://github.com/AaltoAsia/O-MI#configuration-location) of O-MI Node:
    1. Set `omi-service.allowRequestTypesForAll = []`
    2. For anonymous users to get the default permissions from O-MI-Authorization:
        ```
        # to skip authentication when token is not found
        omi-service.authAPI.v2.parameters.skipAuthenticationOnEmpty = ["token"]
        # to set username to empty string when that happens
        omi-service.authAPI.v2.parameters.initial.username = ""
        ```
3. Set some default permissions (change this to fit your needs): `http POST :8001/v1/set-permissions group=DEFAULT permissions:='[{"path":"Objects","request":"rc","allow":true},{"path":"Objects/private","request":"rc","allow":false]'`

## Authentication with https client certificate (using nginx)

**Versions used:**
* O-MI Node: 1.0.2
* O-MI Authentication: 1.0.0
* O-MI Authorization: 1.0.0
* nginx: 1.14.0 (Prior to version 1.11.6, $ssl_client_s_dn_legacy was $ssl_client_s_dn.)

**Instructions:**
1. Install [Authorization module](https://github.com/AaltoAsia/O-MI-Authorization)
2. Install nginx
3. Configure O-MI Node: [application.conf](https://github.com/AaltoAsia/O-MI#configuration-location)
    ```
    omi-service.authAPI.v2 {
      enable = true
      authentication.url = ""
      authorization.url = "http://localhost:8001/v1/get-permissions"

      parameters.initial {
        username = "" # to send empty username if username is not given by nginx
      }
      parameters.fromRequest {
        headers {
          "X-CLIENT-SSL-USER" = "username"
        }
      }
      parameters.toAuthorization {
        jsonbody {
          username = "username"
          request = "requestTypeChar"
        }
      }
    }
    ```
4. Configure nginx
    * put this outside server block to extract CN for the username (*remove "_legacy" if using older than v1.11.6*) and support websockets
        ```
        map $ssl_client_s_dn_legacy $ssl_client_s_dn_cn {
            default "";
            ~/CN=(?<CN>[^/]+) $CN;
        }  
        
        # and websocket support
        map $http_upgrade $connection_upgrade {
            default upgrade;
            '' close;
        }
        ```
    * setup SSL and the route to O-MI Node
        ```
        server {
            listen       443 ssl;
            server_name  localhost;
            
            # Server SSL
            ssl_certificate      server.crt;
            ssl_certificate_key  server.key;

            # Client SSL
            ssl_client_certificate ca.crt;
            ssl_verify_client optional; # or `on` if you require client key

            location / {
                # client certificate verification: SUCCESS, FAILED[:reason] or NONE
                if ($ssl_client_verify ~ "FAILED.*") {
                    return 403;  # Reject the whole request
                }
                # username derived from CN and serial
                proxy_set_header  X-CLIENT-SSL-USER "${ssl_client_s_dn_cn}#${ssl_client_serial}";

                # The usual proxy settings
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header Host $http_host;
                proxy_redirect off;

                proxy_pass http://localhost:8080;

                # websocket
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection $connection_upgrade;
            }
        }
        ```
5. (re)Start o-mi-node, o-mi-authorization and nginx

## Authentication in Kong API manager

If you are using [the authentication plugins of Kong](https://docs.konghq.com/hub/#authentication) you can use the upstream headers set by the plugin(s). For example, there is "X-Consumer-ID" or "X-Credential-Username". Now in O-MI Node you only need a quite usual authz configuration like this:

```
omi-service.authAPI.v2 {
  enable = true
  authentication.url = ""  # skip; already done at this point
  authorization.url = "http://localhost:8001/v1/get-permissions"  # fill this as usual

  parameters {
    fromRequest.headers {
      X-Consumer-ID = "username" # select header to use for "username" in Authorization module
    }
    toAuthorization.jsonbody {   # as usual
      username = "username"
      request = "requestTypeChar"
    }
  }
}
```
