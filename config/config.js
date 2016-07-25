'use strict';

/* globals app, $ */
app.controller('BitbucketCtrl', ['$scope', function ($scope) {

  $scope.config = $scope.providerConfig();
  $scope.config.cache = $scope.config.cache || false;

  $scope.addWebhooks = function () {
    $scope.loadingWebhooks = true;
    $.ajax(`${$scope.api_root}bitbucket/hook`, {
      type: 'POST',
      success: function () {
        $scope.loadingWebhooks = false;
        $scope.success('Set bitbucket webhooks', true);
      },
      error: function () {
        $scope.loadingWebhooks = false;
        $scope.error('Failed to set bitbucket webhooks', true);
      }
    });
  };

  $scope.deleteWebhooks = function () {
    $scope.loadingWebhooks = true;
    $.ajax(`${$scope.api_root}bitbucket/hook`, {
      type: 'DELETE',
      success: function (data) {
        $scope.loadingWebhooks = false;
        $scope.success(data, true);
      },
      error: function () {
        $scope.loadingWebhooks = false;
        $scope.error('Failed to remove bitbucket webhooks', true);
      }
    });
  };

  $scope.save = function () {
    this.providerConfig(this.config);
  };
}]);
