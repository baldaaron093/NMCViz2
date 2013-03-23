from django.conf.urls import patterns, include, url

from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    url(r'^$', 'nmc.views.home', name='home'),
    url(r'^network/', include('network.urls', namespace="network"), name='network'),
    url(r'^admin/', include(admin.site.urls)),
    
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),
)
