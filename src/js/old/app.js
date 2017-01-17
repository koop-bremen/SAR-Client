// SAR Desktop Client
// this file is used for application configuration, factories, dataservices
// etc.
// Controllers are based inside js/controllers.js




var app = angular.module('sw_spotter', ['ionic','ngCordova', 'sw_spotter.controllers','angular-jwt'])


.config(function($compileProvider){
  $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|tel):/);
})
.config(['$compileProvider', function ($compileProvider) {
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|local|data|chrome-extension):/);
}])
//api dataservice
.service('dataService', ['$http', function ($http) {

        var urlBase = swAppConfig.urlBase;
        this.chat_messages = [];
        this.getCases = function () {
          return $http({
              url: urlBase+'cases/spotter', 
              method: "GET",
              params: {session_token: 1337}
           });
        };

        this.updateVehiclePosition = function (options) {

          if(window.updatePosition)
          return $http({
            method: 'POST',
            url: urlBase+'vehicle/updatePosition',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer '+window.localStorage['jwt']
            },
            data: {session_token: 1337, position:options.position}
          });
        };

        this.createCase = function (options){
          return $http({
              url: urlBase+'cases/create', 
              method: "POST",
              params: options.params
           });
        };
        this.updateCases = function (options) {
          return $http({
            method: 'POST',
            url: urlBase+'cases/reloadSpotter',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer '+window.localStorage['jwt']
            },
            data: {cases:options.cases}
          });
        };

        this.auth = function (options){
          return $http({
              url: urlBase+'user/auth', 
              method: "POST",
              params: options.params
           });
        };
        this.getMessages = function(){
            return $http({
                url: urlBase+'messages', 
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer '+window.localStorage['jwt']
                }
            })
        };
        this.sendMessage = function(msgObj){

          return $http({
              url: urlBase+'messages/send', 
              method: "POST",
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer '+window.localStorage['jwt']
              },
              params: msgObj
          });
        };
    }])


//camera factory
.factory('Camera', ['$q', function($q) {

  return {
    getPicture: function(options) {
      var q = $q.defer();

      navigator.camera.getPicture(function(result) {
        // Do any magic you need
        q.resolve(result);
      }, function(err) {
        q.reject(err);
      }, {
                        quality: 20,
                        destinationType: Camera.DestinationType.DATA_URL
                    });

      return q.promise;
    }
  }
}])
.controller('VehicleCtrl',['$scope', 'dataService', function ($scope, dataFactory) {

  //$scope.cases;
  $scope.updateVehiclePosition = function(cb) {
    if(window.updatePosition)
        dataFactory.updateVehiclePosition({position:{accuracy:currentPosition.coords.accuracy, altitudeAccuracy: currentPosition.coords.altitudeAccuracy, heading: currentPosition.coords.heading,  speed: currentPosition.coords.speed,  latitude: currentPosition.coords.latitude,  longitude: currentPosition.coords.longitude}})
            .success(function (result) {
                if(typeof cb === 'function'){
                  cb();
                }
            })
            .error(function (error) {
              if(error !== null)
                $scope.status = 'Unable to load customer data: ' + error.message;
            });
  }
}])
.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);

    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
  });
})
.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

    .state('app', {
    url: '/app',
    abstract: true,
    templateUrl: 'templates/menu.html',
    controller: 'MenuCtrl'
  })

  .state('app.search', {
    url: '/search',
    views: {
      'menuContent': {
        templateUrl: 'templates/search.html'
      }
    }
  })

  .state('app.overview', {
      url: '/overview',
      views: {
        'menuContent': {
          templateUrl: 'templates/overview.html',
          controller: 'AppCtrl'
        }
      }
    })
    .state('app.cases', {
      url: '/cases',
      views: {
        'menuContent': {
          templateUrl: 'templates/all_cases.html',
          controller: 'CasesCtrl'
        }
      }
    })
  .state('app.single', {
    url: '/cases/:caseId',
    views: {
      'menuContent': {
        templateUrl: 'templates/case.html',
        controller: 'CaseCtrl'
      }
    }
  })
  .state('app.caseChat', {
    url: '/cases/chat/:caseId',
    views: {
      'menuContent': {
        templateUrl: 'templates/case_chat.html',
        controller: 'CaseChatCtrl'
      }
    }
  })
  .state('app.create', {
    url: '/case/create',
    views: {
      'menuContent': {
        templateUrl: 'templates/case_create.html',
        controller: 'CaseCtrl'
      }
    }
  });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/overview');
})
.run(function($rootScope) {
  $rootScope.typeOf = function(value) {
    return typeof value;
  };
})

.directive('stringToNumber', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {
      ngModel.$parsers.push(function(value) {
        return '' + value;
      });
      ngModel.$formatters.push(function(value) {
        return parseFloat(value, 10);
      });
    }
  };
})












function takePicture() {
  navigator.camera.getPicture(function(imageURI) {

    // imageURI is the URL of the image that we can use for
    // an <img> element or backgroundImage.

  }, function(err) {

    // Ruh-roh, something bad happened

  }, {});
}





