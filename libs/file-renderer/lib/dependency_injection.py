"""
Dependency Injection Container - 依赖注入容器

提供类型安全的服务注册和解析功能，支持三种生命周期：
- singleton: 单例模式，整个应用生命周期只有一个实例
- scoped: 作用域模式，每个请求一个实例
- transient: 瞬态模式，每次解析都创建新实例

Usage:
    from lib.dependency_injection import ServiceProvider

    # 注册服务
    provider = ServiceProvider()
    provider.register_singleton(Settings, lambda: settings)
    provider.register_scoped(DatabaseSession)
    provider.register_transient(IStorageService, StorageService)

    # 解析服务
    storage = provider.resolve(IStorageService)
"""

from collections.abc import Callable
from enum import Enum, auto
from typing import Any, TypeVar

T = TypeVar("T")


class ServiceLifetime(Enum):
    """服务生命周期"""

    SINGLETON = auto()
    SCOPED = auto()
    TRANSIENT = auto()


class ServiceDescriptor:
    """服务描述符"""

    def __init__(
        self,
        interface: type,
        implementation: type | Callable[..., Any],
        lifetime: ServiceLifetime,
        instance: Any | None = None,
    ) -> None:
        self.interface = interface
        self.implementation = implementation
        self.lifetime = lifetime
        self.instance = instance


class ServiceProvider:
    """
    依赖注入容器

    提供服务的注册、解析和生命周期管理功能。
    """

    def __init__(self) -> None:
        """初始化服务提供器"""
        self._services: dict[type, ServiceDescriptor] = {}
        self._singletons: dict[type, Any] = {}

    def register_singleton(
        self,
        interface: type[T],
        implementation: type[T] | Callable[..., T],
    ) -> "ServiceProvider":
        """
        注册单例服务

        Args:
            interface: 服务接口或类型
            implementation: 实现类或工厂函数

        Returns:
            ServiceProvider: 自身，支持链式调用
        """
        self._services[interface] = ServiceDescriptor(
            interface=interface,
            implementation=implementation,
            lifetime=ServiceLifetime.SINGLETON,
        )
        return self

    def register_scoped(
        self,
        interface: type[T],
        implementation: type[T] | Callable[..., T],
    ) -> "ServiceProvider":
        """
        注册作用域服务

        Args:
            interface: 服务接口或类型
            implementation: 实现类或工厂函数

        Returns:
            ServiceProvider: 自身，支持链式调用
        """
        self._services[interface] = ServiceDescriptor(
            interface=interface,
            implementation=implementation,
            lifetime=ServiceLifetime.SCOPED,
        )
        return self

    def register_transient(
        self,
        interface: type[T],
        implementation: type[T] | Callable[..., T],
    ) -> "ServiceProvider":
        """
        注册瞬态服务

        Args:
            interface: 服务接口或类型
            implementation: 实现类或工厂函数

        Returns:
            ServiceProvider: 自身，支持链式调用
        """
        self._services[interface] = ServiceDescriptor(
            interface=interface,
            implementation=implementation,
            lifetime=ServiceLifetime.TRANSIENT,
        )
        return self

    def register_instance(self, interface: type[T], instance: T) -> "ServiceProvider":
        """
        注册已有实例作为单例

        Args:
            interface: 服务接口或类型
            instance: 服务实例

        Returns:
            ServiceProvider: 自身，支持链式调用
        """
        self._services[interface] = ServiceDescriptor(
            interface=interface,
            implementation=type(instance),
            lifetime=ServiceLifetime.SINGLETON,
            instance=instance,
        )
        self._singletons[interface] = instance
        return self

    def resolve(self, interface: type[T]) -> T:
        """
        解析服务

        Args:
            interface: 服务接口或类型

        Returns:
            服务实例

        Raises:
            KeyError: 如果服务未注册
        """
        if interface not in self._services:
            raise KeyError(f"Service {interface.__name__} is not registered")

        descriptor = self._services[interface]

        if descriptor.lifetime == ServiceLifetime.SINGLETON:
            return self._resolve_singleton(descriptor)
        elif descriptor.lifetime == ServiceLifetime.SCOPED:
            return self._resolve_scoped(descriptor)
        else:  # TRANSIENT
            return self._resolve_transient(descriptor)

    def _resolve_singleton(self, descriptor: ServiceDescriptor) -> Any:
        """解析单例服务"""
        if descriptor.interface in self._singletons:
            return self._singletons[descriptor.interface]

        instance = self._create_instance(descriptor)
        self._singletons[descriptor.interface] = instance
        return instance

    def _resolve_scoped(self, descriptor: ServiceDescriptor) -> Any:
        """解析作用域服务（当前实现为瞬态）"""
        # TODO: 实现真正的请求作用域
        return self._create_instance(descriptor)

    def _resolve_transient(self, descriptor: ServiceDescriptor) -> Any:
        """解析瞬态服务"""
        return self._create_instance(descriptor)

    def _create_instance(self, descriptor: ServiceDescriptor) -> Any:
        """创建服务实例"""
        if callable(descriptor.implementation) and not isinstance(
            descriptor.implementation, type
        ):
            # 工厂函数
            return descriptor.implementation()
        else:
            # 类构造函数
            return descriptor.implementation()

    def is_registered(self, interface: type) -> bool:
        """
        检查服务是否已注册

        Args:
            interface: 服务接口或类型

        Returns:
            是否已注册
        """
        return interface in self._services

    def build_provider(self) -> "ServiceProvider":
        """
        构建最终的服务提供器

        Returns:
            ServiceProvider: 配置完成的服务提供器
        """
        return self


# 全局服务提供器实例
_default_provider: ServiceProvider | None = None


def get_service_provider() -> ServiceProvider:
    """
    获取全局服务提供器

    Returns:
        ServiceProvider: 全局服务提供器实例
    """
    global _default_provider
    if _default_provider is None:
        _default_provider = ServiceProvider()
    return _default_provider


def set_service_provider(provider: ServiceProvider) -> None:
    """
    设置全局服务提供器

    Args:
        provider: 新的服务提供器实例
    """
    global _default_provider
    _default_provider = provider


def resolve_service(interface: type[T]) -> T:
    """
    从全局服务提供器解析服务

    Args:
        interface: 服务接口或类型

    Returns:
        服务实例
    """
    return get_service_provider().resolve(interface)
