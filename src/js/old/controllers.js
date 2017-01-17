
var urlBase = swAppConfig.urlBase;
var currentPosition = {};
var updatePosition;


if(typeof window.localStorage['updatePosition'] !== 'undefined')
  updatePosition = window.localStorage['updatePosition'] == 'true';
else
  updatePosition = false;


angular.module('sw_spotter.controllers', [])


.controller('MenuCtrl', function($scope, $controller, $interval) {
    
    
  $scope.menuObj = {};
  $scope.menuObj.trackPosition = updatePosition;
  $scope.logout = function(){
      window.localStorage.clear();
  }
  $scope.getTrackingStatus = function(){
    //$controller('CasesCtrl', {$scope: $scope});
    if($scope.logged_in){
        console.log('GET TRACKING STATUS:');
        console.log($scope.menuObj);
        window.updatePosition = Boolean($scope.menuObj.trackPosition);
        console.log(window.updatePosition);
        window.localStorage['updatePosition'] = $scope.menuObj.trackPosition;
    }else
        return false;
    
    
        console.log('-------------------');
    return window.updatePosition;
  };
    
})
.controller('CaseChatCtrl', function($scope, $controller, $state, $http, $ionicScrollDelegate) {
    
    console.log('showing chat for case #'+$state.params.caseId);


    $ionicScrollDelegate.$getByHandle('chat').scrollBottom();
    $controller('CasesCtrl', {$scope: $scope});
    $controller('CaseCtrl', {$scope: $scope});
    $scope.case = $scope.getSingleCaseObj($state.params.caseId);
    $scope.chatInput = '';


    //add value for menu
                      angular.forEach($scope.cases, function(case_values, key) {
                        if(case_values.id == $state.params.caseId){
                           $scope.cases[key].unseen_messages = false;
                        }
                      });


    $scope.parseMessage = function(message){
        
        return message;
        
        var matches = message.match(/III(.+?)III/g);
        if(matches != null){
            message = '<img class="chatImage" src="data:image/jpeg;base64,'+matches[0].replace(/III/g,'').replace('"','\"')+'">';
            
        }
        return message;
    };
    $scope.sendMessage = function(){
        $http({
            url: urlBase+'cases/sendMessageCrew',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer '+window.localStorage['jwt']
            },
            data: {
                case_id: $state.params.caseId,
                message: $scope.chatInput,
                sender_type: 'spotter'
            }
        }).then(function(response) {
              if(!response.data.error){
                $scope.chatInput = '';
                
                $ionicScrollDelegate.$getByHandle('chat').scrollBottom();
              }else{
                   $scope.alert(response.error);
              }
        }, function(error) {
               $scope.alert(error.data);
        });
    };
})
     
.controller('AppCtrl', function($scope, $controller, $ionicModal, $ionicPopup, $interval, $cordovaGeolocation, $timeout, $http, $state, global_object_service) {

  $controller('VehicleCtrl', {$scope: $scope});
  $controller('CasesCtrl', {$scope: $scope});
  $controller('MenuCtrl', {$scope: $scope});

  $scope.state = 'map';
  $scope.changeStatus = function(status){
    switch(status){
      
      case 'map':
        $scope.state = 'map';
      break;
      case 'caseview':
        $scope.state = 'caseview';
      break;
    }
  }
  $scope.calculateLocation = function(currentPosition, distance, angle){
        var lat = parseFloat(currentPosition.coords.latitude);
        var lon = parseFloat(currentPosition.coords.longitude);
        var distance = parseFloat(distance);
        var angle = parseFloat(angle);
        
        var radius = Number(6371000);
        var δ = Number(distance) / radius; // angular distance in radians
        var angleRad = Number(angle) * (Math.PI / 180);

        var latRad = lat * (Math.PI / 180);
        var lonRad = lon * (Math.PI / 180);

        var lat2 = Math.asin(Math.sin(latRad)*Math.cos(δ) + Math.cos(latRad)*Math.sin(δ)*Math.cos(angleRad));
        var x = Math.cos(δ) - Math.sin(latRad) * Math.sin(lat2);
        var y = Math.sin(angleRad) * Math.sin(δ) * Math.cos(latRad);
        var lon2 = lonRad + Math.atan2(y, x);
        var latitude = lat2 * (180 / Math.PI);
        var longitude = lon2 * (180 / Math.PI);
        return {lat:latitude,lon:longitude}
  };
  
  var stopUpdateLocation;
  $scope.startLocationUpdater = function() {
      
      
    // Don't start a new fight if we are already fighting
    if ( angular.isDefined(stopUpdateLocation) ) return;
          stopUpdateLocation = $interval(function() {
              
              console.log('update location...');
              
              if(typeof window.localStorage['jwt'] == 'undefined'){
                  console.log('no auth token, show login');
                  
                  $scope.login();
              }else{
                    $scope.updateVehiclePosition(function(){
                        //possible callback
                    });
                  
              }
              
          }, 10000);
  };

  $scope.stopLocationUpdater = function() {
          if (angular.isDefined(stop)) {
            $interval.cancel(stop);
            stop = undefined;
          }
  };
  
  $scope.alert = function(message, cb){
      // Custom popup
      var myPopup = $ionicPopup.alert({
        title: 'ALERT',
        template: message
      });

      myPopup.then(function(res) {
      }); 
      
  }
  
  $scope.getVehicleLableClass = function(){
      return 'online';
  }
  
  //wait for position to be tracked
  //when tracked->initLocationUpdater
  if(typeof $scope.updatePositionInited == 'undefined')
    $scope.updatePositionInited = false;
    var stopWatchPosition = $scope.$watch('position',function(position) {
      
        
      if ($scope.updatePositionInited )return;
      if(position) {
          
        $scope.updatePositionInited = true;
        $scope.startLocationUpdater();
        stopWatchPosition();
      }
  });
  
  //userdata
  $scope.loginData = {
      token:window.localStorage['jwt']
  };

  $scope.userData = {username:window.localStorage['username'], user_id:window.localStorage['userid']}

  $scope.position = {};

  $scope.initModal = function(cb){
    // Create the login modal that we will use later
    $ionicModal.fromTemplateUrl('templates/login.html', {
      scope: $scope
    }).then(function(modal) {
      $scope.modal = modal;
      cb();
    });
  }

  $scope.initMap = function() {
     /*$scope.vehicles = [];*/
     $scope.vehicles = global_object_service.getVehicles();

     swApp.initMap();
  }

  //return time diff in s between last_updated and now
  $scope.getTimeDiffForLabel = function(last_updated){
    var date1 = new Date(last_updated);
    var date2 = new Date();
    var timeDiff = Math.ceil(Math.abs(date2.getTime() - date1.getTime())/1000);
    if(timeDiff < 60 && timeDiff < 3600){
      return timeDiff+' M'
    }
    else if(timeDiff >= 3600 && timeDiff <= 3600*24){
      return Math.ceil(timeDiff/3600)+' H'
    }
    else if(timeDiff > 3600*24){
      return Math.ceil(timeDiff/(3600*24))+'D'
    }else{
      return Math.ceil(timeDiff)+' s'
    }
  }
  $scope.getTimeDiff = function(last_updated){
    var date1 = new Date(last_updated);
    var date2 = new Date();

    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000)); 
  }

  $scope.getVehicleLabelClass = function(last_updated){

    var date1 = new Date(last_updated);
    var date2 = new Date();
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    var timeDiff = $scope.getTimeDiff(last_updated);

    if(timeDiff < 600){
      return 'online';
    }else if(timeDiff > 600 && timeDiff < 1200){
      return 'away';
    }
    return 'offline';
    
  }

  // Triggered in the login modal to close it
  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.login = function() {


    $('#loadingOverlay').slideUp(function(){
      $(this).remove();
    });
    if(typeof $scope.modal == 'undefined'||!$scope.modal._isShown)
    $scope.initModal(function(){


      $scope.modal.show();

    });
  };


  $scope.init = function(){
    $scope.logged_in = false;



    if(typeof $scope.loginData.token === 'undefined'){
      $scope.logged_in = false;
      $scope.login();
    }else{
        //check if token needs to be refreshed
        $http({
                method: 'POST',
                url: urlBase+'user/token',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer '+window.localStorage['jwt']
                },
                data: {session_token: 1337, position:'fuck you'}
        }).then(function(response) {
                if(!response.data.error){
                  //console.log(response);
                  window.localStorage['jwt'] = response.data.token;
                  console.log('token updated');
                  
                  $scope.logged_in = true;

                  $scope.initMap();

                  $('#header_username').html(localStorage.username);
                }else{
                    $scope.logged_in = false;
                    console.log(response.error);
                }
        }, function(error) {
console.log(error);
                if(error.status != 500&&typeof window.localStorage['jwt'] === 'string'){
                  console.log('can not check token, proceeding offline');
                  
                  $scope.logged_in = true;

                  $scope.initMap();
                }else{
                  
                  console.log('Some error occured during the authentification with stored token:');
                  console.log(error);
                  $scope.logged_in = false;
                  $scope.login();
                }
                
        });
    }
    
    //init positionwatch
    $scope.geolocationWatch = $cordovaGeolocation.watchPosition({
      timeout : 10000,
      enableHighAccuracy: true // may cause errors if true
    });

    $scope.geolocationWatch.then(
      null,
      function(err) {
        // error
      },
      function(position) {
        console.log('position tracked:');
        console.log(position.coords);
        $scope.position = position;
        currentPosition = position;
    });

  };



  // Perform the login action when the user submits the login form
  $scope.doLogin = function() {
    $http({
      url: urlBase+'user/auth',
      method: 'POST',
      data: $scope.loginData
    }).then(function(response) {
        if(!response.data.error){
          console.log(response);
          window.localStorage['jwt'] = response.data.token;
          window.localStorage['user'] = response.data.userid;
          window.localStorage['vehicleid'] = response.data.vehicleid;
          window.localStorage['username'] = $scope.loginData.username;
          $('#header_username').html(localStorage.username);

          swApp.initMap();
          $scope.alert('login worked,');
          $scope.logged_in = true;
          $scope.closeLogin();
          $state.go('app.overview');

        }else{
            $scope.alert('Your username or password was wrong.');
        }
    }, function(error) {
         $scope.alert(error.error);
    });
           

    
  };
})



.controller('CasesCtrl',['$scope', 'dataService', '$controller', '$interval', function ($scope, dataFactory, $controller, $interval) {

  $scope.cases;

  //check if cases still need to be loaded
  //so that the request isnt sent several times
  if(typeof $scope.loadCases == 'undefined')
    $scope.loadCases = true;

  $scope.getCases = function(cb) {

        $scope.loadCases = false;
        dataFactory.getCases()
            .success(function (result) {
                if(typeof result.data.emergency_cases == 'string'){
                  $scope.cases = JSON.parse(result.data.emergency_cases);
                }else if(typeof result.data.emergency_cases == 'object'){

                  $scope.cases = result.data.emergency_cases;
                }
                if(typeof cb === 'function'){
                  cb();
                }
            })
            .error(function (error) {
              if(error !== null)
                $scope.status = 'Unable to load customer data: ' + error.scroll;
            });
  };
  
  
  $scope.pushMessagesToCase = function(case_id, messages){
      
      angular.forEach($scope.cases, function(case_data, key) {
          if(case_data.id == case_id){
              angular.forEach(messages, function(message){
                  $scope.cases[key].messages.push(message);
              });
          }
      });
  };
  
  
  
  
  
  
  
  //creates object of
  //{caseid:highestMessageId, caseid2:highestMessageId2}
  $scope.getReloadObj = function(){
      var result = {};
      
      //loop through all cases and get the highest id
      angular.forEach($scope.cases, function(value, key) {
          
        //if object isn set, start with 0
        if(typeof result[value.id] === 'undefined')
            result[value.id] = {last_message_received: 0, updated_at:value.updated_at};
        
        angular.forEach(value.messages, function(mValue, mKey){
            if(parseInt(mValue.id)>result[value.id].last_message_received){

                result[value.id] = {last_message_received: parseInt(mValue.id), updated_at:mValue.updated_at};
            }
        });
      });
      return result;
  };
  
  if($scope.loadCases){
    console.log('init Loading');
    $scope.getCases();
  }
  
  $scope.reloadState = true;
  
  
  $scope.reloadCases = function() {
        var options = {
            cases:$scope.getReloadObj()
        }
        dataFactory.updateCases(options)
            .success(function (result) {
                console.log(result);
                if(result){
                    console.log('UPDATING CASES ...');
                    //alert('update cases now!');
                    angular.forEach(result.data.cases, function(case_values, case_id) {


                      console.log('...updating case #'+case_id);

                      //add value for menu
                      angular.forEach($scope.cases, function(case_values, key) {
                        if(case_values.id == case_id){
                           $scope.cases[key].unseen_messages = true;
                        }
                      });

                      $scope.pushMessagesToCase(case_id, case_values.messages);
                    });
                    
                    console.log(result);
                }
                console.log('... UPDATING CASES DONE');
            })
            .error(function (error) {
              if(error !== null)
                console.log(error);
            });
  }
  
  var stopReload;
  $scope.initReload = function() {
    //return if reload is enabled
    if ( angular.isDefined(stopReload) ) return;
          console.log('inniting reload');
          stopReload = $interval(function() {
              
              console.log('updating cases...');
              if(typeof window.localStorage['jwt'] == 'undefined'){
                  console.log('no auth token, show login');
                  $scope.login();
              }else{
                  $scope.reloadCases();
              }
              
          }, 15000);
  };
   
  //wait for position to be tracked
  //when tracked->initLocationUpdater
  if(typeof $scope.reloadInited == 'undefined')
    $scope.reloadInited = false;

  var stopWatchForReload = $scope.$watch('cases',function(cases) {
      
        
      if ($scope.reloadInited )return;
      if(cases) {
          
        $scope.reloadInited = true;
        $scope.initReload();
        stopWatchForReload();
      }
  });

  //order cases by updated at
  $scope.predicate = 'updated_at';
  $scope.reverse = true;
  $scope.order = function(predicate) {
      $scope.reverse = ($scope.predicate === predicate) ? !$scope.reverse : false;
      $scope.predicate = predicate;
  };
  
  
  
  
}]).

controller('CreateCaseCtr',function($scope, $controller, $location, Camera, dataService){

        $controller('AppCtrl', {$scope: $scope});
        $scope.case = {};

        $scope.createCase = function(){


              //add source type to scope
              $scope.case.source_type = 'spotter_app';
              
              var calculatedLocation = $scope.calculateLocation(currentPosition, $scope.case.spotting_distance, $scope.case.spotting_direction);
              
              $scope.case.location_data = {accuracy:currentPosition.coords.accuracy, altitudeAccuracy: currentPosition.coords.altitudeAccuracy, heading: -1,  speed: -1,  latitude: calculatedLocation.lat,  longitude:  calculatedLocation.lon};
              dataService.createCase({params:$scope.case})
                  .success(function (result) {

                      //push result
                      $scope.alert('your case has been created');
                      $location.path("/app/cases");
                  })
                  .error(function (error) {
                    if(error !== null)
                         $scope.alert(error);
                  });
        }
})

.controller('CaseCtrl', function($scope, $stateParams,$controller,$http, Camera, dataService) {

  $controller('CasesCtrl', {$scope: $scope});
  $controller('AppCtrl', {$scope: $scope});

  //returns single case object by id
  //taken from $scope.cases
  $scope.getSingleCaseObj = function(case_id){
      var result = null
          angular.forEach($scope.cases, function(case_values, key) {
            if(case_values.id == case_id){
               result = case_values;
            }
          });
          return result;
  };

  $scope.getlastLocation = function(case_id){

    var case_data = {};
    angular.forEach($scope.cases, function(case_values, key) {
      if(case_values.id == case_id){
        case_data = case_values;
      }
    });
    if(case_data.locations)
        return case_data.locations[case_data.locations.length-1];
  };

  //there must be a better way...
  if(typeof $stateParams.caseId !== 'undefined')
    var case_id = $stateParams.caseId;


    //wait for cases to be loaded
    var stopWatching = $scope.$watch('cases',function(cases) {
      if(cases) {
          if(case_id){
          $scope.case = $scope.getSingleCaseObj(case_id);
          
          $scope.case.lastLocation = $scope.getlastLocation(case_id+1);
          stopWatching();
          }
      }
    });







  $scope.takePicture = function() {
    console.log('$scope.takePicture() initted, if app crashes => no browser support html5 cam');
    Camera.getPicture().then(function(imageURI) {
      console.log(imageURI);
    }, function(err) {
      console.err(err);
    });
  }

  $scope.createCase = function(){

        //add source type to scope
        $scope.case.source_type = 'spotter_app';
        $scope.case.location_data = {accuracy:$scope.position.coords.accuracy,altitude:$scope.position.coords.altitude,latitude:$scope.position.coords.latitude, longitude:$scope.position.coords.longitude};
        dataService.createCase({params:$scope.case})
            .success(function (result) {

                //push result
                console.log(result);
                if(typeof cb === 'function'){
                  cb();
                }
            })
            .error(function (error) {
              if(error !== null)
                $scope.status = 'Unable to load customer data: ' + error.message;
            });

  };
  
  $scope.updateCaseDetail = function(){
      
          $http({
            method: 'PUT',
            url: urlBase+'case/'+$scope.case.id,
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer '+window.localStorage['jwt']
            },
            data: $scope.case
          }).then(function(response) {
                $scope.alert('Details updated');
                if(!response.data.error){
                  console.log(response);
                }else{
                    console.log(response.error);
                }
            }, function(error) {
                console.log('Some error occured while updating the case:');
                console.log(error);
            });
          
  };
  $scope.updateCaseLocation = function(){
        
      if(typeof currentPosition.coords == 'undefined'){
          alert('your position can not be tracked');
          return true;
      }
      
      var calculatedLocation = $scope.calculateLocation(currentPosition, $scope.case.spotting_distance, $scope.case.spotting_direction);
      
      
          $http({
            method: 'PUT',
            url: urlBase+'caseLocation/'+$scope.case.id,
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer '+window.localStorage['jwt']
            },
            data: {
                
                spotting_distance:$scope.case.spotting_distance,
                spotting_direction:$scope.case.spotting_direction,
                //strange geolocation object needs this transformation:
                position:{accuracy:currentPosition.coords.accuracy, altitudeAccuracy: currentPosition.coords.altitudeAccuracy, heading: -1,  speed: -1,  latitude: calculatedLocation.lat,  longitude: calculatedLocation.lon}
            }
          }).then(function(response) {
                if(!response.data.error){
                  $scope.alert('Position updated');
                }else{
                    console.log(response.error);
                }
            }, function(error) {
                console.log('Some error occured while updating the case:');
                console.log(error);
            });
          
  };
})

.controller('messageController',function($scope, $controller, dataService,$sce){
    $scope.data = {};
    $scope.getLogo = function(vehicle_id){
        var data = swApp.getVehicleData(vehicle_id);
        if(data!=null)
        return data['logo64']
        else return null;
    };
    $scope.getTime = function(dateStr){
        return timeSince(new Date(dateStr));
    };
    $scope.renderHtml = function(html_code)
    {
        return $sce.trustAsHtml(html_code);
    };
    $scope.submitMessage = function(){
      var self = this;
       dataService.sendMessage({id:2,author:{username:'nic',vehicle_id:1},type:'message',text:$scope.data.messagetext,created_at:String(new Date())})
       .then(function successCallback(response) {
            // this callback will be called asynchronously
            // when the response is available
            $scope.messages.push(response.data);
            self.data.messagetext = '';
            //$(".message-list").scrollTop($(".message-list")[0].scrollHeight+300);
            var mydiv = $(".message-list");
            mydiv.scrollTop(mydiv.prop("scrollHeight")+100);
          }, function errorCallback(response) {
            // called asynchronously if an error occurs
            // or server returns response with an error status.
          });
    };
    dataService.getMessages().then(function successCallback(response) {
              // this callback will be called asynchronously
              // when the response is available
              $scope.messages = response.data;

              $(".message-list").scrollTop($(".message-list")[0].scrollHeight);

            }, function errorCallback(response) {
              // called asynchronously if an error occurs
              // or server returns response with an error status.
              console.log(response);

            });

})

.factory('global_object_service', function() {
  return {
      getVehicles : function(){
        return vehicles_obj
      }
  };
});
